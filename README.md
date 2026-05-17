# imgasset

`imgasset` is a command-line tool for generating and compressing image assets with an OpenAI-compatible image API.

It is designed for repeatable local asset workflows:

- save reusable API profiles for base URL, model, image size, quality, and proxy settings;
- keep API keys outside project repositories;
- generate raster originals from JSONL prompt files;
- compress generated outputs through the bundled `tinify-cli` dependency;
- resume interrupted runs without regenerating completed files.

## Installation

Install globally from npm:

```bash
npm install -g @yigemo/imgasset
```

Check the CLI:

```bash
imgasset --help
```

Node.js 20 or newer is required.

## Quick Start

Initialize the global config:

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

Store the image API key outside the project repository:

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

Compress generated originals:

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

## Prompt Format

Each JSONL line describes one output image:

```json
{"out":"article/01-context.png","prompt":"Minimal surreal isometric 3D editorial poster..."}
```

Optional per-job overrides:

```json
{
  "out": "article/02-system-map.png",
  "prompt": "Minimal surreal isometric 3D editorial poster...",
  "model": "gpt-image-2",
  "size": "1536x1024",
  "quality": "medium",
  "outputFormat": "png",
  "n": 1
}
```

The `out` path is resolved inside the raw output directory. Parent-directory escapes are rejected.

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

Recommended `.gitignore` entries for consuming projects:

```gitignore
temp/
.env
.env.*
```

## Secret Handling

Use `imgasset secret set <profile>` for image API keys. The command stores keys under the global config directory instead of the current project.

Environment variable fallback is also supported:

```bash
IMGASSET_API_KEY=... imgasset generate prompts.jsonl
```

`OPENAI_API_KEY` is accepted as a fallback for compatibility.

Avoid passing long-lived keys with `--key` in shared shells because shell history may record the command. Interactive input, stdin, environment variables managed by a password manager, or short-lived keys are safer.

## Commands

```bash
imgasset config init
imgasset profile set <name>
imgasset profile list
imgasset secret set <profile>
imgasset secret unset <profile>
imgasset generate <prompts>
imgasset compress <input>
imgasset run <prompts>
imgasset doctor
```

Run `imgasset help <command>` for command-specific options.

## Roadmap

See [docs/requirements.md](docs/requirements.md) for the public roadmap and design notes.

## Development

```bash
pnpm install
pnpm run build
pnpm run test
pnpm run check
```

Link the local CLI:

```bash
pnpm link --global
imgasset --help
```

## Release

Publishing is tag-driven through GitHub Actions and npm Trusted Publishing.

Configure npm Trusted Publishing for `YGM-Studio/imgasset` with workflow filename `publish.yml`, then run:

```bash
pnpm run release
```

The release script defaults to a patch bump. It also accepts npm version specs:

```bash
pnpm run release -- minor
pnpm run release -- 0.2.0
```

The script updates `package.json`, synchronizes `pnpm-lock.yaml`, runs CI checks, creates a `vX.Y.Z` tag, commits, and pushes the branch and tag. GitHub Actions publishes the package to `https://registry.npmjs.org/` when the tag is pushed.

## License

MIT
