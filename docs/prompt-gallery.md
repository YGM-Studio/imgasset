# Prompt Gallery Roadmap

`imgasset` should treat reusable image prompts as production assets. The prompt text is not a magic phrase; it is a design brief that records the task, visual hierarchy, constraints, and replaceable inputs.

## Naming

Use **Prompt Gallery** as the feature umbrella: a browsable built-in collection of high-quality image prompt patterns.

Use **Template** for deterministic reuse: the user chooses a template, fills variables, and `imgasset` renders a final prompt job.

Use **Suggest** for assisted selection: the user describes a need, and `imgasset` recommends one or more templates.

Use **Compose** for assisted prompt creation: the user describes a need, and an AI planner chooses, trims, combines, or rewrites templates into a final prompt.

Avoid using "hint" as the main concept. A hint sounds like helper text, not a repeatable production primitive.

## Product Layers

### 1. Template

The first layer is deterministic and CLI-first.

Expected commands:

```bash
imgasset template list
imgasset template show handdrawn-knowledge
imgasset template use handdrawn-knowledge \
  --var content=@brief.md \
  --var ratio=16:9 \
  --out article/01-architecture.png \
  --append prompts.jsonl
```

Behavior:

- list built-in templates;
- show metadata, inputs, and the raw template;
- render a template with explicit variables;
- write one JSONL prompt job to stdout or append it to a prompt file;
- keep the existing `generate`, `compress`, and `run` workflow unchanged.

### 2. Suggest

The second layer recommends templates from a user brief.

Example:

```bash
imgasset template suggest "给一篇 Agent 架构文章做技术头图"
```

Initial implementation can be local and rule-based:

- match input type such as Mermaid, city, poem, short slogan, or technical article;
- match tags such as `tech`, `diagram`, `poster`, `wallpaper`, `city`;
- return ranked template IDs with short reasons.

Implemented direction:

- `imgasset template suggest <brief...>` recommends templates without rendering JSONL jobs or rewriting full prompts.
- The command is AI-first when a default planner is configured and has a key.
- If no usable planner exists, it falls back to local rules.
- AI planner config lives in a separate `planner` namespace instead of reusing image generation profiles.
- OpenAI planners use the Responses API; DeepSeek planners use the OpenAI-compatible Chat Completions API.

### 3. Compose

The third layer creates a final prompt from a brief.

Example:

```bash
imgasset template compose "把这段 Mermaid 做成高级技术信息图" \
  --input-file flow.mmd \
  --out article/flow.png \
  --append prompts.jsonl
```

Behavior:

- choose a template or blend compatible templates;
- rewrite the final prompt for the specific task;
- remove irrelevant template sections;
- strengthen missing constraints;
- record provenance such as template ID, template version, planner model, and source brief when prompt job metadata is supported.

Status: future work. Compose should not be folded into `suggest`; `suggest` remains recommendation-only.

## Built-In Template Set

The first gallery should include these reusable prompt patterns:

- `handdrawn-knowledge`: hand-drawn knowledge diagram for technical summaries and architecture notes.
- `info-visual`: editorial information visual for reports, covers, and knowledge content.
- `electronics-mini-poster`: miniature electronics poster for technology themes and short copy.
- `monument-valley-poster`: minimal surreal isometric poster for poetic themes.
- `cold-ink-wallpaper`: cold ink art wallpaper for quiet artistic scenes.
- `impressionist-info-poster`: impressionist editorial poster with left-side information hierarchy.
- `mermaid-infographic`: professional technical infographic reconstructed from Mermaid or related diagram sources.
- `city-line-poster`: minimal line-art city poster for places and landmarks.
- `letter-window-poster`: large-letter theme poster using English or romanized title as the visual container.

## Template Shape

Each template should behave like a small package, not just a long string.

```json
{
  "id": "mermaid-infographic",
  "title": "Mermaid 信息图重构",
  "summary": "把 Mermaid / C4 / Flowchart 重构为专业技术编辑信息图。",
  "tags": ["tech", "diagram", "infographic"],
  "defaultSize": "1536x1024",
  "inputs": [
    {
      "name": "content",
      "label": "Mermaid 源码",
      "required": true
    }
  ],
  "template": "...{content}...",
  "source": "blog:gpt-image-2-prompt-gallery",
  "version": 1
}
```

## Implementation Notes

- The first implementation should not call an AI planner.
- Template rendering should be deterministic and testable.
- Missing required variables should fail before a prompt job is written.
- `template use` should write JSONL compatible with existing `readPromptJobs`.
- Built-in template IDs should be stable because users may script against them.
- Future prompt job metadata should preserve template provenance without breaking existing prompt files.
