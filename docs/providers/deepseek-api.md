# DeepSeek API

Qode provider key: `DeepSeek API`
Environment variable: `DEEPSEEK_API_KEY`

## Intended use

Use this provider for DeepSeek's hosted chat and reasoning models.

## Credential setup

This provider currently supports API key auth via environment variable only.

Set for a single session:
```bash
DEEPSEEK_API_KEY="your-deepseek-key" qode your-chat-args
```

Persist on macOS/Linux:
```bash
echo 'export DEEPSEEK_API_KEY="your-deepseek-key"' >> ~/.bashrc
# or ~/.zshrc
```

Windows PowerShell:
```powershell
$env:DEEPSEEK_API_KEY='your-deepseek-key'
[System.Environment]::SetEnvironmentVariable('DEEPSEEK_API_KEY','your-deepseek-key','User')
```

Interactive `qode auth` setup is not available for this provider yet.

## Runtime auth behavior

- The runtime prefers `DEEPSEEK_API_KEY` from the environment at launch.
- No API key is stored automatically by `qode auth` for this provider today.

## Which activation/payment sources apply

- Requires a DeepSeek developer account with API access enabled.
- Usage follows DeepSeek platform terms.
- Current models are accessed through DeepSeek's API using the above key.

## Headless / server usability

Yes. This provider is suitable for servers and CI when:
- `DEEPSEEK_API_KEY` is provided via environment or secret store,
- and outbound HTTPS to DeepSeek endpoints is allowed.

## Available models

Model options include:
- `deepseek-reasoner`
- `deepseek-chat`

Choose with:
```text
/model deepseek-reasoner
```

Other DeepSeek model IDs may be usable depending on provider mapping.

## Switching models

Change the active model for the current session:
```text
/model deepseek-reasoner
```

## Limits and notes

- Rate and token limits depend on model and account status.
- If authentication appears invalid, recheck the dashboard key.
