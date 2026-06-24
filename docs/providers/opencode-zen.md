# OpenCode Zen

Qode provider key: `OpenCode Zen`
Base URL: `https://opencode.ai/zen/v1`

## API key

- Exact key name: OpenCode Zen API key from the OpenCode Zen account screen/OpenCode provider section.
- Related: OpenCode provider docs at `https://opencode.ai/docs/providers/`.

Save it with:
```bash
qode auth
```

### Environment variable override

Use the exact env var name:

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

## Available models

Current integrated models for this provider:

- `Big Pickle`
- `deepseek-v4-flash-free`
- `nemotron-3-ultra-free`
- `qwen3-5-plus`

Choose one with:
```text
/model Big Pickle
```

## Switching models

Use Qode's model switch command, for example:
```text
/model Big Pickle
```

The model name alias `Big Pickle` maps to the internal model name `big-pickle`.

## Subscription / sign-in

You need an OpenCode-compatible account with access to Zen. Zen access details should be confirmed from OpenCode docs if public availability changes.

## Limits

- Default models in this setup include `Big Pickle`, `deepseek-v4-flash-free`, `nemotron-3-ultra-free`, and `qwen3-5-plus`.
- Limits depend on the selected model and OpenCode access tier.

## Key vs resource name

For Zen, you set the API key as above; OpenCode exposes configurable resource name behavior in its provider docs. Zen here uses the `/zen/v1` base URL.
