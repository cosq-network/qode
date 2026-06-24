# Local model

Qode provider key: `Local`

## Runtime requirement

This provider uses a local inference backend rather than a cloud API key.

Required runtime:
- `llama-server` from `llama.cpp`
- Default bind address: `http://127.0.0.1:8080/v1`

## Intended use

Use this provider to run models locally on the same machine as Qode.

## Credential setup

No API key setup is required.

## Runtime auth behavior

- There is no remote sign-in or token exchange.
- Qode usually manages `llama-server` based on local configuration.

## Environment variables

No provider-specific environment variable is required.

Recommended for automation or servers:
- `LLAMA_SERVER_BIN`, `LLAMA_SERVER_PORT`, and `LLAMA_SERVER_MODEL` may be relevant in a server environment, but local model behavior is still governed by `~/.qode/config.json`.

## Which activation/payment sources apply

No account or subscription is required for local inference when the local model path and runtime are already available.

## Headless / server usability

Yes, subject to resources:
- Ensure `llama-server` is installed and on PATH.
- Ensure enough CPU/RAM/VRAM for the selected GGUF model and requested context.
- Local Qode config should enable the provider with `localModel.enabled = true`.
- Example server config:
  ```json
  {
    "localModel": {
      "enabled": true,
      "autoStart": true,
      "modelPath": "~/.qode/models/your-model.gguf",
      "port": 8080,
      "contextSize": 4096,
      "threads": 4,
      "gpuLayers": 32
    }
  }
  ```
- Set the active model with:
  ```text
  /model your-model-name
  ```

## Available models

Eligible downloaded GGUF models can be used directly with:
```text
/model local
```

## Switching models

Change the active local model for the current session:
```text
/model <local-model-name>
```

Use `qode models` or `/models` to inspect local model status.

## Limits and notes

- Limits depend on hardware resources and the GGUF model.
- More context layers or concurrent sessions may require additional CPU/RAM/VRAM.
