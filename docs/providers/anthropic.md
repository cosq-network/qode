# Anthropic / Claude

Qode provider key: `Anthropic`

## API key

- Exact key name: Anthropic API key from the Anthropic Console.
- Docs page: `https://console.anthropic.com`.

Save it with:
```bash
qode auth
```

### Environment variable override

Use the exact env var name Qode reads:

```bash
ANTHROPIC_API_KEY="your-anthropic-key" qode your-chat-args
```

Persist on macOS/Linux:
```bash
echo 'export ANTHROPIC_API_KEY="your-anthropic-key"' >> ~/.bashrc
# or ~/.zshrc
```

Windows PowerShell:
```powershell
$env:ANTHROPIC_API_KEY='your-anthropic-key'
[System.Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY','your-anthropic-key','User')
```

## Available models

Current integrated model for this provider:

- `claude-3-haiku-20240307`

Choose it with:
```text
/model claude-3-haiku-20240307
```

## Switching models

Use Qode's model switch command, for example:
```text
/model claude-3-haiku-20240307
```

Current integration uses this model in auth validation; other Claude model IDs may be used depending on your Anthropic Console access and provider mapping.

## Subscription / sign-in

You need an Anthropic Console account. API access may require billing-enabled credits or an eligible Claude subscription.

## Limits

- This setup validates the key by sending a small request to the Claude messages endpoint.
- Context and rate limits depend on the Claude model and your Anthropic account tier.