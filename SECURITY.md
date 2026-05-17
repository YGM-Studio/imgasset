# Security Policy

## Secrets

`imgasset` is designed to keep API keys outside project repositories.

- Store image API keys with `imgasset secret set <profile>` or a managed environment variable.
- Do not commit `~/.config/imgasset/secrets.json`, `.env`, generated raw files, or provider credentials.
- Avoid passing long-lived keys through command-line flags in shared shells because shell history may record the value.
- Rotate any key that was ever committed, shared in logs, or used in a public demo.

## Reporting Vulnerabilities

Please report security issues privately to the repository maintainers.

Do not open a public issue containing credentials, exploit details, or private provider configuration. Include enough detail to reproduce the issue without exposing real secrets.
