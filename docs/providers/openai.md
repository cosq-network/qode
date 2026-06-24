# OpenAI

Qode provider key: `OpenAI`

## API key

- Exact key name: OpenAI API key from the OpenAI platform.
- Docs page: `https://platform.openai.com`.

Save it with:
```bash
qode auth
```

### Environment variable override

Use the exact env var name Qode reads:

```bash
OPENAI_API_KEY="your-openai-key" qode your-chat-args
```

Persist on macOS/Linux:
```bash
echo 'export OPENAI_API_KEY="your-openai-key"' >> ~/.bashrc
# or ~/.zshrc
```

Windows PowerShell:
```powershell
$env:OPENAI_API_KEY='your-openai-key'
[System.Environment]::SetEnvironmentVariable('OPENAI_API_KEY','your-openai-key','User')
```

## Available models

Current integrated models for this provider:

- `gpt-5-mini`

Choose one with:
```text
/model gpt-5-mini
```

## Switching models

Use Qode's model switch command, for example:
```text
/model gpt-5-mini
```

## Subscription / sign-in

You need an OpenAI account. Usage requires billing and available credits or a ChatGPT Plus/Pro/Team subscription where API credits are enabled.

## Limits

- Default configured context window in this setup: 128000 tokens.
- Exact limits depend on the selected model and your OpenAI account tier.
