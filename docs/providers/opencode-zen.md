# OpenCode Zen

Qode provider key: `OpenCode Zen`, `OpenCode`

Base URL: https://opencode.ai/zen/v1
Environment variable: `OPENCODE_ZEN_API_KEY`

## Intended use

Use this provider for OpenCode Zen-hosted models.

## Credential setup

This provider currently supports API key auth via environment variable only.

Set for a single session:
```bash
OPENCODE_ZEN_API_KEY="your-opencode-zen-key" qode your-chat-args
```

Persist on macOS/Linux:
```bash
echo 'export OPENCODE_ZEN_API_KEY="your-opencode-zen-key"' >> ~/.bashrc
# or ~/.zshrc
```

Windows PowerShell:
```powershell
$env:OPENCODE_ZEN_API_KEY='your-opencode-zen-key'
[System.Environment]::SetEnvironmentVariable('OPENCODE_ZEN_API_KEY','your-opencode-zen-key','User')
```

Interactive `qode auth` setup is not available for this provider yet.

## Runtime auth behavior

- The runtime prefers `OPENCODE_ZEN_API_KEY` from the environment at launch.
- No API key is stored automatically by `qode auth` for this provider today.

## Which activation/payment sources apply

- Requires compatible OpenCode access.
- Zen access details should be confirmed from OpenCode docs if public availability changes.
- Limits can depend on account tier and selected model.

## Headless / server usability

Yes. This provider is suitable for servers and CI when:
- `OPENCODE_ZEN_API_KEY` is provided via environment or secret store,
- and outbound HTTPS to `https://opencode.ai/zen/v1` is allowed.

## Available models

Current integration includes:
- `Big Pickle`
- `deepseek-v4-flash-free`
- `nemotron-3-ultra-free`
- `qwen3-5-plus`

Choose with:
```text
/model Big Pickle
```

The alias `Big Pickle` maps to the internal model name `big-pickle`.

## Switching models

Change the active model for the current session:
```text
/model Big Pickle
```

## Limits and notes

- Limits depend on the selected model and Zen access state.
- If the provider list changes, check OpenCode provider docs.
