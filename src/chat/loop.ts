import * as readline from 'readline';
import { v4 as uuidv4 } from 'uuid'; // add uuid to package.json
import { loadConfig, saveConfig } from '../config.js';
import { loadSession, saveSession } from '../utils/storage.js';
import { Session } from './session.js';
import { processToolCalls } from './tool-handler.js';
import { findModel } from '../providers/models.js';
import { OpenAICompatProvider } from '../providers/openai-compat.js';
import { GeminiProvider } from '../providers/gemini.js';
import { LLMProvider } from '../providers/base.js';
import { TOOL_DEFINITIONS } from '../tools/definitions.js';
import { setCwd } from '../tools/exec.js';

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function createProvider(modelName: string, config: any): Promise<LLMProvider> {
  const found = findModel(modelName);
  if (!found) throw new Error(`Unknown model: ${modelName}`);

  const providerCfg = config.providers[found.providerKey];
  if (!providerCfg?.apiKey) {
    throw new Error(`No API key configured for ${found.providerKey}. Use /apikey <provider> <key> or run 'cosqcode auth'.`);
  }

  if (found.providerKey === 'Google AI Studio') {
    return new GeminiProvider(found.model, providerCfg.apiKey);
  } else {
    // Determine base URL for each provider
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

export async function startChatLoop(resumeId?: string, initialModel?: string): Promise<void> {
  try {
    const config = await loadConfig();
    let modelName = initialModel || config.defaultModel || 'Gemini 2.5 Flash';
    let session: Session;
    let provider: LLMProvider;

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

    console.log('Type /help for commands. /exit to quit.');
    rl.prompt();

    rl.on('line', async (input) => {
      const trimmed = input.trim();
      if (trimmed === '/exit') {
        rl.close();
        return;
      }
      if (trimmed === '/help') {
        console.log(`Commands:
  /model <provider> <model>   Switch model
  /apikey <provider> <key>    Save a provider API key for this session
  /auth                       Show how to configure API keys outside chat
  /compress                   Force context compression
  /clear                      Clear conversation (keep system)
  /sessions                   List saved sessions
  /save                       Save current session
  /exit                       Quit`);
        rl.prompt();
        return;
      }
      if (trimmed.startsWith('/model')) {
        const parts = trimmed.split(/\s+/);
        if (parts.length < 3) {
          console.log('Usage: /model <provider> <model>');
        } else {
          const newModel = parts[2];
          try {
            provider = await createProvider(newModel, config);
            session.provider = provider;
            session.modelName = newModel;
            console.log(`Switched to ${newModel}`);
          } catch (e) {
            console.error(`Error: ${formatError(e)}`);
          }
        }
        rl.prompt();
        return;
      }
      if (trimmed.startsWith('/apikey')) {
        const parts = trimmed.split(/\s+/);
        if (parts.length < 3) {
          console.log('Usage: /apikey <provider> <key>');
        } else {
          const providerName = parts[1];
          const apiKey = parts.slice(2).join(' ');
          config.providers[providerName] = {
            ...(config.providers[providerName] || {}),
            apiKey,
          };
          await saveConfig(config);
          console.log(`Saved API key for ${providerName}.`);

          try {
            provider = await createProvider(session.modelName, config);
            session.provider = provider;
            console.log(`Updated provider for ${session.modelName}.`);
          } catch (e) {
            console.error(`Error: ${formatError(e)}`);
          }
        }
        rl.prompt();
        return;
      }
      if (trimmed === '/auth') {
        console.log('Use /apikey <provider> <key> to store a key for the current session, or run "cosqcode auth" from your shell.');
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

      // User input
      session.addMessage({ role: 'user', content: trimmed });
      await processTurn(session);
      await saveSession(session.id, session.toJSON());
      rl.prompt();
    });

    rl.on('close', async () => {
      await saveSession(session.id, session.toJSON());
      console.log('Goodbye!');
      process.exit(0);
    });
  } catch (error) {
    console.error(`Error: ${formatError(error)}`);
    process.exitCode = 1;
  }
}

async function processTurn(session: Session): Promise<void> {
  try {
    // Compress context if needed before sending
    await session.compressIfNeeded();

    let response = await session.provider.chat(session.messages, TOOL_DEFINITIONS);
    session.addMessage(response.message);

    // Loop while there are tool calls
    while (response.message.tool_calls && response.message.tool_calls.length > 0) {
      await processToolCalls(response.message.tool_calls!, session.messages);
      response = await session.provider.chat(session.messages, TOOL_DEFINITIONS);
      session.addMessage(response.message);
    }

    // Print assistant response
    console.log(`\n${response.message.content}\n`);
  } catch (e) {
    console.error(`Error: ${formatError(e)}`);
  }
}