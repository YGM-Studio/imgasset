# imgasset

`imgasset` is a CLI for generating and compressing image assets through an OpenAI-compatible image API.

The goal is to make image asset production reusable across projects:

- save reusable API profiles such as base URL, model, image size, quality, and proxy;
- keep API keys out of project repositories;
- generate image originals from JSONL prompt files;
- compress generated outputs through `tinify-cli`;
- support repeatable, resumable project workflows.

This repository is private while the tool is being hardened. The project may be open sourced later after the CLI, security model, and documentation are stable.

See [docs/requirements.md](docs/requirements.md) for the current product requirements.

## Install For Local Development

```bash
pnpm install
pnpm run build
pnpm link --global
```

The CLI command is:

```bash
imgasset --help
```

## Basic Workflow

Initialize local config:

```bash
imgasset config init
```

Create a reusable image API profile:

```bash
imgasset profile set default \
  --base-url https://api.example.com/v1 \
  --model gpt-image-2 \
  --size 1536x1024 \
  --quality medium \
  --output-format png \
  --proxy http://127.0.0.1:7890 \
  --default
```

Store the API key outside the project repository:

```bash
imgasset secret set default
```

Write prompts as JSONL:

```jsonl
{"out":"article/01-context.png","prompt":"Minimal surreal isometric 3D editorial poster..."}
{"out":"article/02-flow.png","prompt":"Minimal surreal isometric 3D editorial poster..."}
```

Generate originals:

```bash
imgasset generate prompts.jsonl \
  --raw-dir temp/imgasset/article/raw \
  --skip-existing
```

Compress generated originals through the bundled `tinify-cli` dependency:

```bash
imgasset compress temp/imgasset/article/raw \
  --out-dir public/assets/article \
  --format jpeg \
  --background white \
  --suffix ""
```

Generate and compress in one command:

```bash
imgasset run prompts.jsonl \
  --raw-dir temp/imgasset/article/raw \
  --publish-dir public/assets/article \
  --format jpeg \
  --background white \
  --skip-existing
```

Check local readiness:

```bash
imgasset doctor
```

## Config Files

Global config is stored outside project repositories:

```text
~/.config/imgasset/config.json
~/.config/imgasset/secrets.json
```

API keys are stored in `secrets.json` with owner-only permissions when the platform supports it. They are not written to project config, prompt files, reports, or normal logs.

Optional project config:

```json
{
  "profile": "default",
  "rawDir": "temp/imgasset/article/raw",
  "publishDir": "public/assets/article",
  "compress": {
    "format": "jpeg",
    "background": "white",
    "suffix": ""
  }
}
```

Project config must not contain API keys.

## Development

```bash
pnpm run build
pnpm run test
pnpm run check
```
