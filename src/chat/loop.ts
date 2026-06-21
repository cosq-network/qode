import * as readline from 'readline';
import { v4 as uuidv4 } from 'uuid';
import { loadConfig } from '../config.js';
import { loadSession, saveSession } from '../utils/storage.js';
import { Session } from './session.js';
import { findModel } from '../providers/models.js';
import { OpenAICompatProvider } from '../providers/openai-compat.js';
import { GeminiProvider } from '../providers/gemini.js';
import { LLMProvider } from '../providers/base.js';
import { TOOL_DEFINITIONS } from '../tools/definitions.js';
import { setCwd, executeToolCall } from '../tools/exec.js';
import { startMCPClients, MCPClient } from '../tools/mcp-client.js';

let mcpClients: MCPClient[] = [];
let allTools: any[] = []; // merged local + MCP tools

async function createProvider(modelName: string, config: any): Promise<LLMProvider> {
  const found = findModel(modelName);
  if (!found) throw new Error(`Unknown model: ${modelName}`);

  const providerCfg = config.providers[found.providerKey];
  if (!providerCfg?.apiKey)
    throw new Error(`No API key configured for ${found.providerKey}. Run 'cosqcode auth'.`);

  if (found.providerKey === 'Google AI Studio') {
    return new GeminiProvider(found.model, providerCfg.apiKey);
  } else {
    let baseURL = providerCfg.baseURL;
    if (!baseURL) {
      switch (found.providerKey) {
        case 'DeepSeek API': baseURL = 'https://api.deepseek.com/v1'; break;
        case 'OpenRouter': baseURL = 'https://openrouter.ai/api/v1'; break;
        case 'GroqCloud': baseURL = 'https://api.groq.com/openai/v1'; break;
        case 'GitHub Models': baseURL = 'https://models.inference.ai.azure.com'; break;
        default: baseURL = 'https://api.openai.com/v1';
      }
    }
    return new OpenAICompatProvider(found.providerKey, found.model, providerCfg.apiKey, baseURL);
  }
}

async function rebuildAllTools(config: any) {
  // start with built-in tools
  const builtIn = [...TOOL_DEFINITIONS];
  // add MCP tools from connected clients
  const mcpTools: any[] = [];
  if (config.mcpServers?.length) {
    mcpClients = await startMCPClients(config.mcpServers);
    for (const client of mcpClients) {
      for (const tool of client.tools) {
        mcpTools.push({
          type: 'function' as const,
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          },
        });
      }
    }
    if (mcpTools.length) console.log(`Loaded ${mcpTools.length} MCP tools.`);
  }
  allTools = [...builtIn, ...mcpTools];
}

async function executeTool(toolName: string, toolArgs: Record<string, any>): Promise<string> {
  // first check MCP clients
  for (const client of mcpClients) {
    if (client.tools.some((t) => t.name === toolName)) {
      return await client.callTool(toolName, toolArgs);
    }
  }
  // fallback to built-in exec
  return await executeToolCall(toolName, toolArgs);
}

export async function startChatLoop(resumeId?: string, initialModel?: string): Promise<void> {
  const config = await loadConfig();
  let modelName = initialModel || config.defaultModel || 'Gemini 2.5 Flash';
  let provider: LLMProvider;
  let session: Session;

  // rebuild tool list (may include MCP)
  await rebuildAllTools(config);

  // session creation or resume
  if (resumeId) {
    const data = await loadSession(resumeId);
    modelName = data.modelName;
    provider = await createProvider(modelName, config);
    session = new Session(data.id, provider, undefined, data.messages);
    console.log(`Resumed session ${resumeId} with model ${modelName}`);
  } else {
    provider = await createProvider(modelName, config);
    session = new Session(uuidv4(), provider);
    await saveSession(session.id, session.toJSON());
    console.log(`New session ${session.id} with ${modelName}`);
  }

  setCwd(process.cwd());

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  });

  console.log(`Working directory: ${process.cwd()}`);
  console.log('Type /help for commands, /exit to quit.');
  rl.prompt();

  rl.on('line', async (input) => {
    const trimmed = input.trim();
    if (trimmed === '/exit') {
      rl.close();
      return;
    }
    if (trimmed === '/help') {
      console.log(`
Commands:
  /model <provider> <model>   Switch model
  /review <file1> [file2 ...]  Review one or more files
  /suggest <task description>  Generate code suggestion
  /compress                   Force context compression
  /clear                      Clear conversation (keep system)
  /sessions                   List saved sessions
  /save                       Save current session
  /exit                       Quit
      `);
      rl.prompt();
      return;
    }

    // Model switching
    if (trimmed.startsWith('/model')) {
      const parts = trimmed.split(' ');
      if (parts.length < 3) {
        console.log('Usage: /model <provider> <model>');
      } else {
        const newModel = parts[2];
        try {
          provider = await createProvider(newModel, config);
          session.provider = provider;
          session.modelName = newModel;
          console.log(`Switched to ${newModel}`);
        } catch (e: any) {
          console.log(`Error: ${e.message}`);
        }
      }
      rl.prompt();
      return;
    }

    // Code review command
    if (trimmed.startsWith('/review')) {
      const parts = trimmed.split(' ');
      if (parts.length < 2) {
        console.log('Usage: /review <file1> [file2 ...]');
      } else {
        const filePaths = parts.slice(1);
        for (const fp of filePaths) {
          try {
            const content = await executeTool('file_read', { path: fp });
            if (content.startsWith('Error:')) {
              console.log(`Skipping ${fp}: ${content}`);
              continue;
            }
            console.log(`\n🔍 Reviewing ${fp}...`);
            session.addMessage({
              role: 'user',
              content: `Please perform a detailed code review of the file **${fp}**. Consider bugs, security, performance, style, and best practices.\n\n\`\`\`\n${content}\n\`\`\``,
            });
            await processTurn(session);
          } catch (e: any) {
            console.log(`Error reading ${fp}: ${e.message}`);
          }
        }
        await saveSession(session.id, session.toJSON());
      }
      rl.prompt();
      return;
    }

    // Generate code suggestion
    if (trimmed.startsWith('/suggest')) {
      const task = trimmed.slice('/suggest'.length).trim();
      if (!task) {
        console.log('Usage: /suggest <description of what you want to implement>');
      } else {
        session.addMessage({
          role: 'user',
          content: `Write code to ${task}. Provide the full implementation with explanation.`,
        });
        await processTurn(session);
        await saveSession(session.id, session.toJSON());
      }
      rl.prompt();
      return;
    }

    if (trimmed === '/compress') {
      await session.compressIfNeeded();
      await saveSession(session.id, session.toJSON());
      rl.prompt();
      return;
    }
    if (trimmed === '/clear') {
      session.messages = [session.messages[0]]; // keep system
      console.log('Conversation cleared.');
      await saveSession(session.id, session.toJSON());
      rl.prompt();
      return;
    }
    if (trimmed === '/sessions') {
      const { listSessions } = await import('../utils/storage.js');
      await listSessions();
      rl.prompt();
      return;
    }
    if (trimmed === '/save') {
      await saveSession(session.id, session.toJSON());
      console.log('Session saved.');
      rl.prompt();
      return;
    }

    // Normal user input
    session.addMessage({ role: 'user', content: trimmed });
    await processTurn(session);
    await saveSession(session.id, session.toJSON());
    rl.prompt();
  });

  rl.on('close', async () => {
    await saveSession(session.id, session.toJSON());
    // close MCP clients
    for (const client of mcpClients) await client.close();
    console.log('Goodbye!');
    process.exit(0);
  });
}

async function processTurn(session: Session): Promise<void> {
  try {
    // compress context if needed before sending
    await session.compressIfNeeded();

    let response = await session.provider.chat(session.messages, allTools);
    session.addMessage(response.message);

    // loop while there are tool calls
    while (response.message.tool_calls && response.message.tool_calls.length > 0) {
      for (const toolCall of response.message.tool_calls) {
        const fnName = toolCall.function.name;
        const fnArgs = JSON.parse(toolCall.function.arguments);
        console.log(`⚙ Executing ${fnName}...`);
        const result = await executeTool(fnName, fnArgs);
        console.log(result.slice(0, 200) + (result.length > 200 ? '...' : ''));
        session.addMessage({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: fnName,
          content: result,
        });
      }
      response = await session.provider.chat(session.messages, allTools);
      session.addMessage(response.message);
    }

    console.log(`\n${response.message.content}\n`);
  } catch (e: any) {
    console.log(`Error: ${e.message}`);
  }
}