import { CliError } from "./errors.js";
import { listPromptTemplates } from "./templates.js";
import type { PromptTemplate } from "./templates.js";

export interface TemplateRecommendation {
  id: string;
  title: string;
  confidence: number;
  reason: string;
  variables: Record<string, string>;
}

export interface SuggestResult {
  mode: "ai" | "local";
  planner?: string;
  fallbackReason?: string;
  recommendations: TemplateRecommendation[];
}

export interface ComposeResult {
  templateId: string;
  templateTitle: string;
  prompt: string;
  size?: string;
  quality?: string;
  outputFormat?: string;
  reason?: string;
}

export interface TemplateMetadata {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  inputs: Array<{ name: string; label: string; required: boolean; description?: string }>;
  defaultSize?: string;
}

export function templateMetadata(): TemplateMetadata[] {
  return listPromptTemplates().map((template) => ({
    id: template.id,
    title: template.title,
    summary: template.summary,
    tags: template.tags,
    inputs: template.inputs.map((input) => ({
      name: input.name,
      label: input.label,
      required: input.required,
      description: input.description
    })),
    defaultSize: template.defaultSize
  }));
}

export function suggestLocalTemplates(brief: string, top: number): TemplateRecommendation[] {
  const normalized = brief.toLowerCase();
  const scores = new Map<string, { score: number; reasons: string[] }>();

  const add = (id: string, score: number, reason: string): void => {
    const current = scores.get(id) || { score: 0, reasons: [] };
    current.score += score;
    if (!current.reasons.includes(reason)) {
      current.reasons.push(reason);
    }
    scores.set(id, current);
  };

  if (/\b(flowchart|sequencediagram|statediagram|erdiagram|classdiagram|gantt|timeline|graph\s+(td|lr|rl|bt)|mermaid|c4\b)\b/i.test(brief)) {
    add("mermaid-infographic", 100, "输入看起来包含 Mermaid 或结构图语法。");
  }
  if (/(架构|architecture|api|sdk|agent|tool|tools|orchestrator|pipeline|workflow|流程|系统|技术|工程|模块|链路)/i.test(brief)) {
    add("handdrawn-knowledge", 80, "适合把技术机制或架构内容压缩成知识图解。");
    add("info-visual", 55, "适合把主题和观点转成编辑感信息视觉。");
  }
  if (/(wallpaper|壁纸|艺术|清冷|孤独|安静|留白|油墨|绘画|情绪|星际|电影感)/i.test(brief)) {
    add("cold-ink-wallpaper", 85, "适合生成留白充足、情绪明确的艺术壁纸。");
  }
  if (/(诗|诗句|课件|语文|quote|短句|俳句|古文|文学|蜻蜓|荷|月|春|秋|雪|山水)/i.test(brief)) {
    add("impressionist-info-poster", 76, "适合诗句、课件和编辑型信息海报。");
    add("monument-valley-poster", 58, "适合把短句转成诗意等距空间海报。");
  }
  if (/(城市|街区|地标|旅行|海报|city|street|landmark|bund|外滩|上海|杭州|北京|深圳|广州|成都|东京|巴黎|纽约)/i.test(brief)) {
    add("city-line-poster", 82, "适合城市、街区和地标的线描收藏海报。");
    add("letter-window-poster", 72, "适合以城市拼音或主题英文标题为核心的收藏海报。");
  }
  if (/(slogan|口号|品牌|主视觉|展会|科技|电子|元器件|芯片|电源|连接|能源|工业|poster|封面|社媒)/i.test(brief)) {
    add("electronics-mini-poster", 74, "适合科技品牌、短文案和微缩电子场景海报。");
  }
  if (/(ppt|报告|封面|cover|自媒体|头图|插图|资料|观点|趋势|内容)/i.test(brief)) {
    add("info-visual", 65, "适合报告、封面和知识内容头图。");
  }

  if (scores.size === 0) {
    add("info-visual", 45, "通用主题可先用信息视觉模板建立清晰画面。");
    add("handdrawn-knowledge", 38, "如果内容偏知识解释，可用手绘知识图解。");
    add("monument-valley-poster", 32, "如果主题偏短句或意象，可用纪念碑谷气质海报。");
  }

  return rankRecommendations(scores, brief, top);
}

export function normalizeAiRecommendations(value: unknown, top: number): TemplateRecommendation[] {
  const rawItems = extractRecommendationItems(value);
  const byId = new Map(listPromptTemplates().map((template) => [template.id, template]));
  const seen = new Set<string>();
  const result: TemplateRecommendation[] = [];

  for (const item of rawItems) {
    const id = readStringProperty(item, "id");
    if (!id || seen.has(id)) {
      continue;
    }
    const template = byId.get(id);
    if (!template) {
      continue;
    }
    seen.add(id);
    result.push({
      id,
      title: template.title,
      confidence: clampConfidence(readNumberProperty(item, "confidence") ?? 0.5),
      reason: readStringProperty(item, "reason") || "AI planner recommended this template.",
      variables: readVariables(item, template)
    });
    if (result.length >= top) {
      break;
    }
  }

  if (result.length === 0) {
    throw new CliError("AI planner did not return any valid template IDs.");
  }
  return result;
}

export function normalizeComposeResult(value: unknown, fallbackTemplateId?: string): ComposeResult {
  if (!value || typeof value !== "object") {
    throw new CliError("AI planner response is not a JSON object.");
  }
  const byId = new Map(listPromptTemplates().map((template) => [template.id, template]));
  const id = readStringProperty(value, "templateId") || fallbackTemplateId;
  if (!id) {
    throw new CliError("AI planner response does not contain templateId.");
  }
  const template = byId.get(id);
  if (!template) {
    throw new CliError(`AI planner returned unknown templateId: ${id}`);
  }
  const prompt = readStringProperty(value, "prompt");
  if (!prompt) {
    throw new CliError("AI planner response does not contain prompt.");
  }
  return {
    templateId: id,
    templateTitle: template.title,
    prompt,
    size: readStringProperty(value, "size") || template.defaultSize,
    quality: readStringProperty(value, "quality") || template.defaultQuality,
    outputFormat: readStringProperty(value, "outputFormat") || template.defaultOutputFormat,
    reason: readStringProperty(value, "reason") || undefined
  };
}

export function buildSuggestInstruction({
  brief,
  top
}: {
  brief: string;
  top: number;
}): string {
  return JSON.stringify(
    {
      task: "Recommend built-in image prompt templates for the user's brief. Do not rewrite the full prompt.",
      output: {
        recommendations: [
          {
            id: "template-id",
            confidence: 0.9,
            reason: "short reason in the user's language",
            variables: { primaryInputName: "suggested concise input value or hint" }
          }
        ]
      },
      rules: [
        `Return at most ${top} recommendations.`,
        "Use only template IDs from the templates list.",
        "Return valid JSON only. No Markdown.",
        "Variables should be concise and should not contain a full rendered prompt.",
        "If uncertain, prefer broadly useful templates over niche templates."
      ],
      brief,
      templates: templateMetadata()
    },
    null,
    2
  );
}

export function buildComposeInstruction({
  brief,
  templateId
}: {
  brief: string;
  templateId?: string;
}): string {
  const templates = templateId ? [getTemplateForCompose(templateId)] : listPromptTemplates();
  return JSON.stringify(
    {
      task: "Choose a built-in imgasset image prompt template and compose the final image-generation prompt for the user's brief.",
      output: {
        templateId: "chosen-template-id",
        prompt: "final complete image generation prompt",
        size: "optional image size, only if the chosen template has a strong default",
        quality: "optional quality override",
        outputFormat: "optional output format override",
        reason: "short reason in the user's language"
      },
      rules: [
        "Return valid JSON only. No Markdown.",
        "Use only template IDs from the templates list.",
        "The prompt must be ready to send to an image generation model.",
        "You may trim irrelevant template sections, but preserve the selected template's core visual constraints.",
        "Do not invent facts, metrics, current events, prices, rankings, or brand claims not present in the brief.",
        "Do not include API keys, shell commands, JSONL, or explanations inside prompt.",
        "If the brief contains source material, include it in the prompt as content to visualize.",
        templateId ? `You must use templateId ${templateId}.` : "Choose the best template for the brief."
      ],
      brief,
      templates: templates.map((template) => ({
        id: template.id,
        title: template.title,
        summary: template.summary,
        tags: template.tags,
        defaultSize: template.defaultSize,
        inputs: template.inputs.map((input) => ({
          name: input.name,
          label: input.label,
          required: input.required,
          description: input.description,
          default: input.default
        })),
        template: template.template
      }))
    },
    null,
    2
  );
}

function getTemplateForCompose(id: string): PromptTemplate {
  const template = listPromptTemplates().find((item) => item.id === id);
  if (!template) {
    throw new CliError(`Template not found: ${id}`);
  }
  return template;
}

function rankRecommendations(
  scores: Map<string, { score: number; reasons: string[] }>,
  brief: string,
  top: number
): TemplateRecommendation[] {
  const byId = new Map(listPromptTemplates().map((template) => [template.id, template]));
  const maxScore = Math.max(...Array.from(scores.values()).map((item) => item.score), 1);
  return Array.from(scores.entries())
    .sort((left, right) => right[1].score - left[1].score || left[0].localeCompare(right[0]))
    .slice(0, top)
    .map(([id, item]) => {
      const template = byId.get(id);
      if (!template) {
        throw new CliError(`Unknown built-in template: ${id}`);
      }
      return {
        id,
        title: template.title,
        confidence: clampConfidence(item.score / maxScore),
        reason: item.reasons[0] || template.summary,
        variables: suggestedVariables(template, brief)
      };
    });
}

function suggestedVariables(template: PromptTemplate, brief: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const input of template.inputs) {
    if (input.name === template.primaryInput || input.required) {
      values[input.name] = brief;
      continue;
    }
    if (input.default) {
      values[input.name] = input.default;
    }
  }
  return values;
}

function extractRecommendationItems(value: unknown): unknown[] {
  if (!value || typeof value !== "object") {
    throw new CliError("AI planner response is not a JSON object.");
  }
  const recommendations = (value as { recommendations?: unknown }).recommendations;
  if (!Array.isArray(recommendations)) {
    throw new CliError("AI planner response does not contain recommendations.");
  }
  return recommendations;
}

function readStringProperty(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const item = (value as Record<string, unknown>)[key];
  return typeof item === "string" && item.length > 0 ? item : null;
}

function readNumberProperty(value: unknown, key: string): number | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const item = (value as Record<string, unknown>)[key];
  return typeof item === "number" && Number.isFinite(item) ? item : null;
}

function readVariables(value: unknown, template: PromptTemplate): Record<string, string> {
  if (!value || typeof value !== "object") {
    return {};
  }
  const variables = (value as Record<string, unknown>).variables;
  if (!variables || typeof variables !== "object" || Array.isArray(variables)) {
    return {};
  }
  const allowed = new Set(template.inputs.map((input) => input.name));
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(variables)) {
    if (allowed.has(key) && typeof item === "string" && item.length > 0) {
      result[key] = item;
    }
  }
  return result;
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.max(0, Math.min(1, value));
}
