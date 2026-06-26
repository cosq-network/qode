# OpenRouter

Qode provider key: `OpenRouter`
Environment variable: `OPENROUTER_API_KEY`

## Intended use

Use this provider to access a wide model marketplace through a single OpenRouter API key.

## Credential setup

This provider currently supports API key auth via environment variable only.

Set for a single session:
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

Interactive `qode auth` setup is not available for this provider yet.

## Runtime auth behavior

- The runtime prefers `OPENROUTER_API_KEY` from the environment at launch.
- No API key is stored automatically by `qode auth` for this provider today.

## Which activation/payment sources apply

- Requires an OpenRouter account.
- Some models require credits, prepaid balances, or enabled subscriptions.
- Model availability can depend on account settings and OpenRouter routing.
- Preferred subscription or account-based access applies according to OpenRouter's current terms.

## Headless / server usability

Yes. This provider is suitable for servers and CI when:
- `OPENROUTER_API_KEY` is provided via environment or secret store,
- and outbound HTTPS to OpenRouter endpoints is allowed.

## Available models

Model options include:
- `poolside/laguna-m-1`
- `qwen/qwen3-coder`
- `openai/gpt-oss-120b`

Choose with:
```text
/model qwen/qwen3-coder
```

Other OpenRouter models may be usable if they are available on your account and route.

## Switching models

Change the active model for the current session:
```text
/model qwen/qwen3-coder
```

## Limits and notes

- Usage limits depend on model and your OpenRouter plan.
- Credit/billing requirements apply for paid models.
