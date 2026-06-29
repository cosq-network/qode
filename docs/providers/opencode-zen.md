# OpenCode Zen

Qode provider key: `OpenCode Zen`

Base URL: https://opencode.ai/zen/v1
Environment variable: `OPENCODE_ZEN_API_KEY`

## Intended use

Use this provider for OpenCode Zen-hosted models.

## Credential setup

This provider supports API key auth through `/auth set opencode` or an environment variable.

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

Interactive setup:
```text
/auth set opencode
```

## Runtime auth behavior

- The runtime prefers `OPENCODE_ZEN_API_KEY` from the environment at launch.
- If no environment key is present, it uses encrypted credentials stored by `/auth set opencode`.

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
- `big-pickle`
- `deepseek-v4-flash-free`
- `nemotron-3-ultra-free`

Choose with:
```text
/model big-pickle
```

The alias `Big Pickle` still maps to `big-pickle`.

## Switching models

Change the active model for the current session:
```text
/model big-pickle
```

## Limits and notes

- Limits depend on the selected model and Zen access state.
- If the provider list changes, check OpenCode provider docs.
