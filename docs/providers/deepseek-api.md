# DeepSeek API

Qode provider key: `DeepSeek API`

## API key

- Exact key name: DeepSeek API key from the developer dashboard.
- Docs page: `https://api-docs.deepseek.com/`.

Save it with:
```bash
qode auth
```

### Environment variable override

Use the exact env var Qode reads:

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

## Available models

Current integrated models for this provider:

- `DeepSeek V4-Pro`
- `DeepSeek V4-Flash`

Choose one with:
```text
/model DeepSeek V4-Pro
```

## Switching models

Use Qode's model switch command, for example:
```text
/model DeepSeek V4-Pro
```

## Subscription / sign-in

You need a DeepSeek developer account with API access enabled.

## Limits

- Default models in this setup include `DeepSeek V4-Pro` and `DeepSeek V4-Flash`.
- Review the DeepSeek platform docs for rate and token limits by model.

## When `qode auth` prompts show only "DeepSeek API"

That is the configured provider name used by Qode. The credential it saves is the DeepSeek API key itself.
