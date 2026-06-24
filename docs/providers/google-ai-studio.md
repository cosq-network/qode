# Google AI Studio

Qode provider key: `Google AI Studio`

## API key

- Exact key name: Google AI Studio API key.
- Primary references: `https://aistudio.google.com` and `https://ai.google.dev/gemini-api/docs/api-key`.

Save it with:
```bash
qode auth
```

### Environment variable override
For CI or persistent shells, set the exact env var name:

```bash
GOOGLE_API_KEY="your-google-api-key" qode your-chat-args
```

Persist on macOS/Linux by adding to your profile:
```bash
echo 'export GOOGLE_API_KEY="...'" >> ~/.bashrc
# or ~/.zshrc
```

Windows PowerShell:
```powershell
$env:GOOGLE_API_KEY='...'
# or for the current user:
[System.Environment]::SetEnvironmentVariable('GOOGLE_API_KEY','...','User')
```

If `GOOGLE_API_KEY` is present at launch, Qode uses it automatically.

## Available models

Current integrated models for this provider:

- `Gemini 3.1 Pro Preview`
- `Gemini 2.5 Flash`

Choose one with:
```text
/model Gemini 3.1 Pro Preview
```

## Switching models

Use Qode's model switch command, for example:
```text
/model Gemini 2.5 Flash
```

Available models in this setup include `Gemini 3.1 Pro Preview` and `Gemini 2.5 Flash`.

## Subscription / sign-in

No paid Google subscription is required for basic API access. If you have Google AI Ultra/Workspace, use the same API key.

## Limits

- Context is model-dependent: up to 1M tokens for Flash/Pro-style models.
- Rate limits depend on your Google AI Studio tier.
