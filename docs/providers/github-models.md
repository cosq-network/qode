# GitHub Models

Qode provider key: `GitHub Models`

## API key

- Exact credential: GitHub personal access token with access to GitHub Models.
- Manage it in Settings -> Developer settings -> Personal access tokens.

Save it with:
```bash
qode auth
```

### Environment variable override

GitHub Models integration follows the documentation configurable Terraform provider with the required key being `github_token`, so use the exact variable name below:

```bash
GITHUB_MODELS_API_KEY="your-github-token" qode your-chat-args
```

Recommended shell persistence:

macOS/Linux:
```bash
echo 'export GITHUB_MODELS_API_KEY="your-github-token"' >> ~/.bashrc
# or ~/.zshrc
```

Windows PowerShell:
```powershell
$env:GITHUB_MODELS_API_KEY='your-github-token'
# or persistent:
[System.Environment]::SetEnvironmentVariable('GITHUB_MODELS_API_KEY','your-github-token','User')
```

## Available models

Current integrated models for this provider:

- `DeepSeek-R1`
- `o4-mini`
- `Llama-4-Scout-17B`

Choose one with:
```text
/model DeepSeek-R1
```

## Switching models

Use Qode's model switch command, for example:
```text
/model DeepSeek-R1
```

## Subscription / sign-in

You need a GitHub account. Availability can depend on GitHub Models access settings.

## Limits

- Default models in this setup include `DeepSeek-R1`, `o4-mini`, and `Llama-4-Scout-17B`.
- Exact limits depend on model and your access level.

## Authentication behavior

If you store credentials with `qode auth`, Qode reads them from its secure encrypted auth storage (`~/.qode/auth.json`). For automation, prefer the environment variable form above.
