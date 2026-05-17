# imgasset Requirements

## 1. Background

Several projects need the same image asset workflow:

1. configure an OpenAI-compatible image API provider;
2. generate raster originals from prompt files;
3. keep raw originals and API keys out of Git;
4. compress and convert publishable assets with `tinify-cli`;
5. reference the compressed outputs from websites, blogs, apps, or documentation.

The current workflow has already been validated in a blog repository with a project-local script. `imgasset` should turn that workflow into a reusable CLI that can be installed once and used across many repositories.

## 2. Product Goal

`imgasset` should be a small, reliable command-line tool for repeatable image asset generation and compression.

The first complete version should let a user:

- save one or more image API profiles;
- save API keys securely outside project source control;
- generate images from a JSONL prompt file;
- resume interrupted generation without redoing completed images;
- compress generated images through `tinify-cli`;
- write compressed assets to a project publish directory;
- produce a clear run summary with generated paths, compressed sizes, and failures.

## 3. Non-Goals For The First Version

The first version should not try to be a full design studio.

Out of scope:

- graphical user interface;
- prompt marketplace;
- image editing or inpainting workflows;
- masking, reference images, or multi-image edit pipelines;
- web service mode;
- cloud storage upload;
- automatic Markdown insertion;
- automatic Git commit or push;
- project-specific blog logic.

These can be considered later after the core CLI is stable.

## 4. Target Users

Primary users:

- developers maintaining content sites, blogs, product pages, and documentation;
- teams that repeatedly generate article illustrations, hero images, thumbnails, or UI-adjacent visual assets;
- maintainers who want a repeatable local workflow instead of ad hoc scripts.

Assumptions:

- users are comfortable with terminal commands;
- users can provide API credentials;
- users understand that generated originals and secrets must not be committed.

## 5. Technology Direction

Recommended implementation:

- runtime: Node.js LTS;
- language: TypeScript;
- package manager: pnpm;
- CLI framework: `commander` or `cac`;
- config validation: `zod`;
- HTTP client: `undici` or native `fetch`;
- compression dependency: `tinify-cli`;
- test runner: `vitest`;
- binary command: `imgasset`;
- package name: `@yigemo/imgasset`;
- public package name can be revisited before open sourcing.

`tinify-cli` should be a normal dependency of this project so users can install one package and run generation plus compression without manually installing a second CLI.

## 6. Core Concepts

### Profile

A profile stores reusable API and generation defaults.

Example fields:

```json
{
  "baseURL": "https://api.example.com/v1",
  "model": "gpt-image-2",
  "size": "1536x1024",
  "quality": "medium",
  "outputFormat": "png",
  "proxy": "http://127.0.0.1:7890",
  "timeoutSeconds": 360,
  "retries": 2
}
```

The API key is intentionally not shown here. It belongs in secret storage.

### Prompt Job

A prompt job describes one output image.

Minimum JSONL line:

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

### Raw Output

Raw generated files are the original model outputs.

Default location:

```text
temp/imgasset/<task>/raw/
```

Raw outputs are useful for auditing and regeneration, but should normally be ignored by Git.

### Publish Output

Publish outputs are compressed assets ready to be referenced by the consuming project.

Example:

```text
public/assets/posts/2026/my-article/01-context.jpg
```

## 7. Configuration Requirements

### Global Config

Global config should live outside project repositories.

Recommended path:

```text
~/.config/imgasset/config.json
```

It should contain profiles, default profile name, and non-secret defaults.

Example:

```json
{
  "defaultProfile": "default",
  "profiles": {
    "default": {
      "baseURL": "https://api.example.com/v1",
      "model": "gpt-image-2",
      "size": "1536x1024",
      "quality": "medium",
      "outputFormat": "png",
      "proxy": "http://127.0.0.1:7890",
      "timeoutSeconds": 360,
      "retries": 2
    }
  }
}
```

### Secret Storage

API keys must not be written to project config, prompt files, logs, or reports.

Preferred order:

1. system keychain when practical;
2. local secret file with strict permissions;
3. environment variable fallback.

MVP secret file path:

```text
~/.config/imgasset/secrets.json
```

The CLI must create the file with owner-only permissions when possible.

Example logical shape:

```json
{
  "profiles": {
    "default": {
      "apiKey": "..."
    }
  }
}
```

The CLI should mask keys in all terminal output:

```text
sk-abc1************9xyz
```

### Project Config

Project-level config is optional. It should be safe to commit.

Recommended filename:

```text
imgasset.config.json
```

Example:

```json
{
  "profile": "default",
  "rawDir": "temp/imgasset/blog-images/raw",
  "publishDir": "public/assets/posts/2026/blog-images",
  "compress": {
    "format": "jpeg",
    "background": "white",
    "suffix": ""
  }
}
```

Project config must never contain API keys.

## 8. CLI Commands

### `imgasset config init`

Create the global config directory and an empty config file if they do not exist.

Acceptance criteria:

- does not overwrite existing config unless `--force` is passed;
- prints the config path;
- does not ask for or store an API key.

### `imgasset profile set <name>`

Create or update a profile.

Useful options:

```bash
imgasset profile set default \
  --base-url https://api.example.com/v1 \
  --model gpt-image-2 \
  --size 1536x1024 \
  --quality medium \
  --output-format png \
  --proxy http://127.0.0.1:7890
```

Acceptance criteria:

- validates that `baseURL` is HTTPS;
- validates size and output format;
- preserves unspecified existing fields;
- does not store API keys.

### `imgasset secret set <profile>`

Store an API key for a profile.

Example:

```bash
imgasset secret set default
```

The command should prompt for the API key without echoing it.

Acceptance criteria:

- does not print the full key;
- stores the key outside project repositories;
- verifies file permissions when using the local secret file fallback.

### `imgasset profile list`

List saved profiles without secrets.

Acceptance criteria:

- shows profile names, base URLs, model names, and whether a secret exists;
- masks any sensitive value if displayed.

### `imgasset generate <prompts>`

Generate raw images from a JSONL file.

Example:

```bash
imgasset generate prompts.jsonl \
  --profile default \
  --raw-dir temp/imgasset/blog-images/raw \
  --skip-existing
```

Acceptance criteria:

- reads JSONL jobs line by line;
- validates required `out` and `prompt`;
- sends one API request per prompt job;
- writes generated originals to the raw directory;
- supports `--skip-existing`;
- supports `--force` to overwrite existing outputs;
- retries transient failures;
- respects `retry_after` from compatible error responses;
- never logs the full API key.

### `imgasset compress <input>`

Compress image files through `tinify-cli`.

Example:

```bash
imgasset compress temp/imgasset/blog-images/raw \
  --out-dir public/assets/posts/2026/blog-images \
  --format jpeg \
  --background white \
  --suffix ""
```

Acceptance criteria:

- invokes the local dependency-provided `tinify-cli`;
- preserves nested directories;
- supports JPEG, PNG, and WebP if supported by `tinify-cli`;
- reports original size, compressed size, and saving ratio;
- exits non-zero if compression fails.

### `imgasset run <prompts>`

Generate and compress in one command.

Example:

```bash
imgasset run prompts.jsonl \
  --profile default \
  --raw-dir temp/imgasset/blog-images/raw \
  --publish-dir public/assets/posts/2026/blog-images \
  --format jpeg \
  --background white \
  --skip-existing
```

Acceptance criteria:

- runs generation first;
- compresses only successfully generated or existing raw files;
- produces a final summary;
- exits non-zero if any required job fails;
- supports resumable workflows.

### `imgasset doctor`

Check local readiness.

Acceptance criteria:

- reports Node version;
- reports whether global config exists;
- reports whether the selected profile exists;
- reports whether an API key exists for the profile without printing it;
- reports whether the proxy is configured;
- reports whether `tinify-cli` can be executed;
- optionally checks network connectivity to the image API base URL.

## 9. Image API Requirements

The first version should support OpenAI-compatible `/images/generations`.

Endpoint:

```text
POST <baseURL>/images/generations
```

Minimum request body:

```json
{
  "model": "gpt-image-2",
  "prompt": "...",
  "size": "1536x1024",
  "quality": "medium",
  "n": 1,
  "output_format": "png"
}
```

Expected response:

```json
{
  "data": [
    {
      "b64_json": "..."
    }
  ]
}
```

The CLI should also be designed so response URL mode can be added later, but `b64_json` is enough for the first version.

## 10. Compression Requirements

`imgasset` should depend on `tinify-cli` and invoke it programmatically or through a child process.

Default compression behavior:

- recursive input;
- output directory required for publish assets;
- JPEG format for web article illustrations unless overridden;
- white background when converting transparent images to JPEG;
- no suffix by default when converting `raw/name.png` to `publish/name.jpg`.

Example equivalent command:

```bash
tinify temp/task/raw --recursive --out-dir public/assets/task --format jpeg --background white --suffix ""
```

The CLI should surface `tinify-cli` errors clearly, including authentication or quota failures.

## 11. Error Handling

The CLI should distinguish:

- invalid config;
- missing API key;
- invalid prompt file;
- output already exists;
- network error;
- HTTP API error;
- retryable gateway timeout;
- malformed API response;
- image decode/write failure;
- compression failure.

For retryable API failures:

- retry with exponential backoff;
- if response body includes `retry_after`, respect it within a maximum wait cap;
- print concise progress messages.

For non-retryable errors:

- fail fast with a clear message;
- never print secrets;
- leave successfully generated files in place so the next run can resume.

## 12. Logging And Reports

Default output should be concise and useful in terminal logs.

Example:

```text
[1/4] generating temp/imgasset/task/raw/01-context.png
[1/4] wrote temp/imgasset/task/raw/01-context.png in 54.3s
[2/4] skipping existing temp/imgasset/task/raw/02-flow.png
compressing 4 image(s) to public/assets/task
summary: generated 3, skipped 1, compressed 4, failed 0
```

Optional JSON report:

```bash
imgasset run prompts.jsonl --report report.json
```

Report fields:

- profile name;
- prompt file path;
- raw output paths;
- publish output paths;
- generation durations;
- compression size before and after;
- errors.

The report must not include API keys.

## 13. Security Requirements

Hard requirements:

- no API keys in project config;
- no API keys in prompt files;
- no API keys in generated reports;
- no API keys in normal logs;
- no generated raw `temp/` files committed by default examples;
- `.env` ignored in generated starter templates;
- secret file permissions checked when local file storage is used.

Recommended documentation:

- explain that private repositories are still not a safe place for secrets;
- recommend password managers or system keychain for long-lived keys;
- recommend rotating keys before open sourcing old internal repositories.

## 14. Project File Conventions

Recommended project layout when used inside another repo:

```text
prompts/
  my-task.jsonl
temp/
  imgasset/
    my-task/
      raw/
public/
  assets/
    my-task/
imgasset.config.json
```

Recommended `.gitignore` entries in consuming projects:

```gitignore
temp/
.env
.env.*
```

## 15. MVP Acceptance Criteria

The MVP is complete when:

- `imgasset profile set` can save a profile;
- `imgasset secret set` can save a masked API key outside a project repo;
- `imgasset generate` can generate images from JSONL;
- `imgasset compress` can compress generated outputs through `tinify-cli`;
- `imgasset run` can generate and compress in one command;
- interrupted runs can resume with `--skip-existing`;
- `imgasset doctor` can identify missing config, missing secret, or missing compression setup;
- README documents the basic workflow;
- tests cover config parsing, JSONL parsing, secret masking, command option merging, and retry classification.

## 16. Suggested Milestones

### Milestone 1: Repository And CLI Skeleton

- TypeScript project setup;
- package scripts;
- CLI entry point;
- command parser;
- basic tests and linting.

### Milestone 2: Config And Secret Storage

- global config reader/writer;
- profile commands;
- local secret fallback;
- key masking;
- `doctor` command.

### Milestone 3: Image Generation

- JSONL parser;
- OpenAI-compatible image request;
- base64 image writing;
- retry and `retry_after` support;
- resumable output handling.

### Milestone 4: Compression

- add `tinify-cli` dependency;
- wrapper around compression command;
- compression summaries;
- publish directory handling.

### Milestone 5: One-Command Workflow

- `run` command;
- project config support;
- JSON report;
- end-to-end test with mocked API and mocked compression.

### Milestone 6: Open Source Readiness

- security review;
- docs cleanup;
- examples without real credentials;
- license decision;
- package naming decision;
- release workflow.

## 17. Open Questions

- Should secrets use macOS Keychain first, or should the MVP start with a strict-permission local file?
- Should the package stay private on npm until the open source review is complete, or be published publicly under `@yigemo/imgasset` immediately?
- Should project config support YAML, or keep JSON only for predictability?
- Should prompt files support JSON arrays in addition to JSONL?
- Should compression support multiple output variants in one run, such as JPEG plus WebP?
- Should future versions support image editing and reference images through a separate command namespace?
