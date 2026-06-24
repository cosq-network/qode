# GroqCloud

Qode provider key: `GroqCloud`
Environment variable: `GROQ_API_KEY`

## Intended use

Use this provider for Groq-hosted models optimized for low-latency inference.

## Credential setup

This provider currently supports API key auth via environment variable only.

Set for a single session:
```bash
GROQ_API_KEY="your-groq-key" qode your-chat-args
```

Persist on macOS/Linux:
```bash
echo 'export GROQ_API_KEY="your-groq-key"' >> ~/.bashrc
# or ~/.zshrc
```

Windows PowerShell:
```powershell
$env:GROQ_API_KEY='your-groq-key'
[System.Environment]::SetEnvironmentVariable('GROQ_API_KEY','your-groq-key','User')
```

Interactive `qode auth` setup is not available for this provider yet.

## Runtime auth behavior

- The runtime prefers `GROQ_API_KEY` from the environment at launch.
- No API key is stored automatically by `qode auth` for this provider today.

## Which activation/payment sources apply

- Requires a GroqCloud account.
- Usage and feature access can depend on account state.
- Some tiers may have rate or model restrictions.

## Headless / server usability

Yes. This provider is suitable for servers and CI when:
- `GROQ_API_KEY` is provided via environment or secret store,
- and outbound HTTPS to Groq endpoints is allowed.

## Available models

Current integration includes:
- `Qwen3 (32B)`
- `Llama 4 Scout (17B)`

Choose with:
```text
/model Qwen3 (32B)
```

Other model IDs may be usable depending on account access and provider mapping.

## Switching models

Change the active model for the current session:
```text
/model Qwen3 (32B)
```

## Limits and notes

- Rate and token limits depend on model and account tier.
- If authentication appears invalid, recheck the dashboard key.
