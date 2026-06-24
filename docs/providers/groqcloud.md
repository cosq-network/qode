# GroqCloud

Qode provider key: `GroqCloud`

## API key

- Exact key name: Groq API key from the Groq Console/Cloud dashboard.
- Docs page: `https://console.groq.com/docs/quickstart`.

Save it with:
```bash
qode auth
```

### Environment variable override

Qode maps this provider to:

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

## Available models

Current integrated models for this provider:

- `Qwen3 (32B)`
- `Llama 4 Scout (17B)`

Choose one with:
```text
/model Qwen3 (32B)
```

## Switching models

Use Qode's model switch command, for example:
```text
/model Qwen3 (32B)
```

## Subscription / sign-in

You need a GroqCloud account.

## Limits

- Default models in this setup include `Qwen3 (32B)` and `Llama 4 Scout (17B)`.
- Use Groq's docs for current rate and token limits per model.

## Verification

Some Groq providers recommend verifying the saved key by calling a models list endpoint if needed. If authentication appears invalid, recheck the dashboard key and then rerun `qode auth`.
