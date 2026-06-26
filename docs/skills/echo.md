# Echo skill

## What it does
The echo skill persists shell environment updates for bash and zsh by writing managed export blocks to startup files.

## Tools
Key tool:
- `echo_update_shell_env`

## Example usage
Set an environment variable:
```text
Set QODE_HOME to /opt/qode for bash and zsh.
```

Add a PATH entry:
```text
Prepend /opt/qode/bin to PATH for zsh.
```
