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

Optional: configure an AI planner for template suggestions:

```bash
imgasset planner set openai --provider openai --model gpt-5.5 --default
imgasset planner secret set openai
```

DeepSeek is also supported through its OpenAI-compatible chat API:

```bash
imgasset planner set deepseek --provider deepseek --model deepseek-v4-flash
imgasset planner secret set deepseek
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

Reference-image jobs:

```json
{
  "out": "article/03-doodle-logo.png",
  "prompt": "Use the reference logo as the identity anchor and redraw it as a playful child doodle.",
  "images": ["refs/imgasset-logo.jpg"],
  "size": "1024x1024"
}
```

When a job includes `images` or `mask`, `imgasset` calls the image edits endpoint with `multipart/form-data` and uploads local image files as binary parts. Without `images` or `mask`, it uses the normal image generations endpoint with JSON. Reference image paths are resolved from the current working directory and must be relative paths inside the project. Large reference images can fail through some proxies or compatible gateways; resize or compress references first when possible.

The `out` path is resolved inside the raw output directory. Parent-directory escapes are rejected.

## Prompt Templates

`imgasset` includes a small built-in Prompt Gallery for reusable image prompt templates.

List templates:

```bash
imgasset template list
```

Inspect a template:

```bash
imgasset template show mermaid-infographic
```

Render a template as a JSONL prompt job:

```bash
imgasset template use mermaid-infographic \
  --var content=@flow.mmd \
  --out article/flow.png \
  --append prompts.jsonl
```

Template rendering is deterministic. It only fills variables and writes a prompt job; generation still runs through the normal `generate` or `run` commands.

Recommend templates from a brief:

```bash
imgasset template suggest "把这段 Mermaid 做成高级技术信息图"
```

By default, `suggest` uses the default AI planner when one is configured and has an API key. If no planner is ready, it falls back to local matching rules and stays usable offline.

Use a specific planner, force local rules, or print JSON:

```bash
imgasset template suggest "给杭州做一张收藏级城市海报" --planner deepseek
imgasset template suggest "给一篇 Agent 架构文章做头图" --local
imgasset template suggest "诗句 小荷才露尖尖角" --json
```

Compose a final prompt job with an AI planner:

```bash
imgasset template compose "给一篇 Agent 架构文章做手绘知识图解" \
  --out article/agent-map.png \
  --append prompts.jsonl
```

Force a specific template or include a source file:

```bash
imgasset template compose "把这段 Mermaid 做成高级技术信息图" \
  --template mermaid-infographic \
  --input-file flow.mmd \
  --out article/flow.png \
  --append prompts.jsonl
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
imgasset planner set <name>
imgasset planner list
imgasset planner secret set <name>
imgasset planner secret unset <name>
imgasset secret set <profile>
imgasset secret unset <profile>
imgasset template list
imgasset template show <id>
imgasset template use <id>
imgasset template suggest <brief>
imgasset template compose <brief>
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
