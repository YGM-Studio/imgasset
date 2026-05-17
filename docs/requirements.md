# imgasset Roadmap

This document records the public product direction for `imgasset`: a small command-line tool for repeatable image asset generation and compression.

## Goals

`imgasset` focuses on local, project-friendly image workflows:

- configure one or more OpenAI-compatible image API profiles;
- keep image API keys outside project repositories;
- generate raster originals from JSONL prompt files;
- resume interrupted generation with `--skip-existing`;
- compress generated assets through the bundled `tinify-cli` dependency;
- write publish-ready images into a project asset directory.

The tool is intentionally scriptable. It should fit content sites, documentation sites, product pages, design notes, and other repositories that need repeatable visual asset production without building a full design studio.

## Non-Goals

The current scope does not include:

- graphical user interface;
- prompt marketplace;
- cloud storage upload;
- web service mode;
- automatic Markdown editing;
- automatic Git commit or push;
- project-specific site logic.

These can be considered later if they fit the CLI-first workflow.

## Core Concepts

### Profile

A profile stores reusable API and generation defaults.

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

API keys are not stored in profiles. They belong in secret storage or managed environment variables.

### Prompt Job

A prompt job describes one output image.

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

Recommended location:

```text
temp/imgasset/<task>/raw/
```

Raw outputs are useful for auditing and regeneration, but should normally be ignored by Git.

### Publish Output

Publish outputs are compressed assets ready to be referenced by the consuming project.

Example:

```text
public/assets/<task>/01-context.jpg
```

## Current Features

- Global config under `~/.config/imgasset/`.
- Profile management with `imgasset profile set` and `imgasset profile list`.
- Local secret file fallback with owner-only permissions where supported.
- Environment variable fallback through `IMGASSET_API_KEY` and `OPENAI_API_KEY`.
- JSONL prompt parsing.
- OpenAI-compatible `/images/generations` requests with `b64_json` response handling.
- Retry handling for transient API failures.
- Path escape protection for prompt output paths.
- Generation resume support through `--skip-existing`.
- Compression through the bundled `@yigemo/tinify-cli` dependency.
- Combined `imgasset run` flow for generation plus compression.
- `imgasset doctor` for local readiness checks.
- Tag-driven npm releases through GitHub Actions and npm Trusted Publishing.

## Security Principles

Hard requirements:

- no API keys in project config;
- no API keys in prompt files;
- no API keys in generated reports;
- no API keys in normal logs;
- no generated raw files committed by default examples;
- `.env` ignored in starter or example project layouts;
- local secret files use restrictive permissions where the platform supports it.

Recommended practice:

- use `imgasset secret set <profile>` or a managed environment variable for API keys;
- avoid passing long-lived keys through command-line flags in shared shells;
- rotate any key that was committed, shared in logs, or used in public examples.

## Near-Term Roadmap

### Better Reports

Add optional machine-readable reports for generation and compression runs.

Potential fields:

- profile name;
- prompt file path;
- raw output paths;
- publish output paths;
- generation durations;
- compression size before and after;
- errors without secrets.

### Compression Summaries

Surface original size, compressed size, and saving ratio from compression runs when the underlying compressor exposes that data.

### Stronger Validation

Improve validation for:

- image size;
- output format;
- model-specific quality options;
- proxy URL shape;
- project config schema errors.

### Secret Storage Options

Evaluate system keychain support as an alternative to the current strict-permission local secret file.

### Image Editing Workflows

Consider a separate command namespace for edit/inpainting/reference-image workflows while keeping generation simple.

## Future Considerations

- Should project config support YAML, or keep JSON only for predictability?
- Should prompt files support JSON arrays in addition to JSONL?
- Should compression support multiple output variants in one run, such as JPEG plus WebP?
- Should network diagnostics be added to `imgasset doctor`?
- Should the tool expose reusable library APIs in addition to the CLI?
