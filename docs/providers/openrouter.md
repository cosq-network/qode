# OpenRouter

Qode provider key: `OpenRouter`

## API key

- Exact credential: OpenRouter API key created in OpenRouter.
- Key management page: `https://openrouter.ai/keys`.

Save it with:
```bash
qode auth
```

### Environment variable override

Use the exact env var name:

```bash
OPENROUTER_API_KEY="your-openrouter-key" qode your-chat-args
```

Persist on macOS/Linux:
```bash
echo 'export OPENROUTER_API_KEY="your-openrouter-key"' >> ~/.bashrc
# or ~/.zshrc
```

Windows PowerShell:
```powershell
$env:OPENROUTER_API_KEY='your-openrouter-key'
[System.Environment]::SetEnvironmentVariable('OPENROUTER_API_KEY','your-openrouter-key','User')
```

## Switching models

Use Qode's model switch command, for example:
```text
/model gpt-oss-120b
```

## Subscription / sign-in

You need an OpenRouter account. Some models require credits or subscriptions.

## Limits

- Default models in this setup include `Laguna M.1 (Poolside)`, `Qwen3-Coder`, and `gpt-oss-120b`.
- Token and rate limits depend on the model and your OpenRouter plan.

## Available models

Current integrated models for this provider:

- `Laguna M.1 (Poolside)`
- `Qwen3-Coder`
- `gpt-oss-120b`

Choose one with:
```text
/model Laguna M.1 (Poolside)
```

OpenRouter also exposes many additional models; other IDs may work if they are available on your OpenRouter account and route.

## Switching models

Use Qode's model switch command, for example:
