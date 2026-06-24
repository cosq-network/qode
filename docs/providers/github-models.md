# GitHub Models

Qode provider key: `GitHub Models`

Environment variable: `GITHUB_MODELS_API_KEY`
Reference pages:
- https://github.com/marketplace/models
- https://docs.github.com/en/github-models

## Intended use

Use this provider for GitHub marketplace/inference models through a GitHub token.

## Credential setup

This provider currently supports token auth via environment variable only.

Set for a single session:
```bash
GITHUB_MODELS_API_KEY="your-github-token" qode your-chat-args
```

Persist on macOS/Linux:
```bash
echo 'export GITHUB_MODELS_API_KEY="your-github-token"' >> ~/.bashrc
# or ~/.zshrc
```

Windows PowerShell:
```powershell
$env:GITHUB_MODELS_API_KEY='your-github-token'
[System.Environment]::SetEnvironmentVariable('GITHUB_MODELS_API_KEY','your-github-token','User')
```

Interactive `qode auth` setup is not available for this provider yet.

## Runtime auth behavior

- The runtime prefers `GITHUB_MODELS_API_KEY` from the environment at launch.
- No token is stored automatically by `qode auth` for this provider today.

## Which activation/payment sources apply

- Requires a GitHub account.
- Model access and rate limits can depend on GitHub access state.
- Getting a 404 or 403 from model invocations may reflect GitHub model access settings more than token format.

## Headless / server usability

Yes. This provider is suitable for servers and CI when:
- `GITHUB_MODELS_API_KEY` is provided via environment or secret store,
- and outbound HTTPS to GitHub API endpoints is allowed.

## Available models

Current integration includes:
- `DeepSeek-R1`
- `o4-mini`
- `Llama-4-Scout-17B`

Choose with:
```text
/model DeepSeek-R1
```

Other model IDs may be usable depending on account access and provider mapping.

## Switching models

Change the active model for the current session:
```text
/model DeepSeek-R1
```

## Limits and notes

- Rate and token limits depend on account access level and model.
- If authentication appears invalid, check token scope.
