import { ProxyAgent } from "undici";
import { CliError, ImageApiError } from "./errors.js";
import { USER_AGENT } from "./package-info.js";
import { buildSuggestInstruction, normalizeAiRecommendations } from "./suggest.js";
import { DEFAULT_PLANNER_PROFILES } from "./types.js";
import type { Runtime } from "./io.js";
import type { PlannerProfile } from "./types.js";
import type { TemplateRecommendation } from "./suggest.js";

export interface ResolvedPlannerOptions {
  plannerName: string;
  provider: PlannerProfile["provider"];
  baseURL: string;
  model: string;
  proxy?: string;
  timeoutSeconds: number;
  retries: number;
  apiKey: string;
}

export async function suggestTemplatesWithPlanner({
  brief,
  top,
  options,
  runtime
}: {
  brief: string;
  top: number;
  options: ResolvedPlannerOptions;
  runtime: Runtime;
}): Promise<TemplateRecommendation[]> {
  const instruction = buildSuggestInstruction({ brief, top });
  const response = await requestWithRetries(instruction, options, runtime);
  return normalizeAiRecommendations(response, top);
}

export function resolvePlannerProfile(name: string, profile: PlannerProfile, apiKey: string): ResolvedPlannerOptions {
  const defaults = DEFAULT_PLANNER_PROFILES[profile.provider];
  return {
    plannerName: name,
    provider: profile.provider,
    baseURL: profile.baseURL || defaults.baseURL,
    model: profile.model || defaults.model,
    proxy: profile.proxy,
    timeoutSeconds: profile.timeoutSeconds || defaults.timeoutSeconds,
    retries: profile.retries ?? defaults.retries,
    apiKey
  };
}

async function requestWithRetries(instruction: string, options: ResolvedPlannerOptions, runtime: Runtime): Promise<unknown> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= options.retries + 1; attempt += 1) {
    try {
      return await requestPlanner(instruction, options, runtime);
    } catch (error) {
      lastError = error;
      if (attempt > options.retries || !isRetryable(error)) {
        break;
      }
      await sleep(Math.max(2, 2 ** attempt) * 1000);
    }
  }
  throw lastError;
}

async function requestPlanner(instruction: string, options: ResolvedPlannerOptions, runtime: Runtime): Promise<unknown> {
  if (options.provider === "openai") {
    return await requestOpenAI(instruction, options, runtime);
  }
  return await requestDeepSeek(instruction, options, runtime);
}

async function requestOpenAI(instruction: string, options: ResolvedPlannerOptions, runtime: Runtime): Promise<unknown> {
  const response = await requestJson({
    endpoint: `${options.baseURL.replace(/\/+$/, "")}/responses`,
    payload: {
      model: options.model,
      input: [
        {
          role: "system",
          content: "You recommend imgasset image prompt templates. Return JSON only."
        },
        {
          role: "user",
          content: instruction
        }
      ],
      text: {
        format: {
          type: "json_object"
        }
      }
    },
    options,
    runtime
  });
  return parseJsonText(extractOpenAIText(response));
}

async function requestDeepSeek(instruction: string, options: ResolvedPlannerOptions, runtime: Runtime): Promise<unknown> {
  const response = await requestJson({
    endpoint: `${options.baseURL.replace(/\/+$/, "")}/chat/completions`,
    payload: {
      model: options.model,
      messages: [
        {
          role: "system",
          content: "You recommend imgasset image prompt templates. Return JSON only."
        },
        {
          role: "user",
          content: instruction
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2
    },
    options,
    runtime
  });
  return parseJsonText(extractChatText(response));
}

async function requestJson({
  endpoint,
  payload,
  options,
  runtime
}: {
  endpoint: string;
  payload: unknown;
  options: ResolvedPlannerOptions;
  runtime: Runtime;
}): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutSeconds * 1000);
  const init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
    dispatcher?: unknown;
  } = {
    method: "POST",
    headers: {
      authorization: `Bearer ${options.apiKey}`,
      "content-type": "application/json",
      accept: "application/json",
      "user-agent": USER_AGENT
    },
    body: JSON.stringify(payload),
    signal: controller.signal
  };
  if (options.proxy) {
    init.dispatcher = new ProxyAgent(options.proxy);
  }

  try {
    const response = await runtime.fetchImpl(endpoint, init as RequestInit);
    const text = await response.text();
    if (!response.ok) {
      throw new ImageApiError(`HTTP ${response.status}: ${text}`, { status: response.status });
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new CliError("Planner API response is not valid JSON.");
    }
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new CliError(`Planner request timed out after ${options.timeoutSeconds}s.`);
    }
    throw new CliError(error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(timeout);
  }
}

function extractOpenAIText(response: unknown): string {
  if (response && typeof response === "object" && typeof (response as { output_text?: unknown }).output_text === "string") {
    return (response as { output_text: string }).output_text;
  }
  if (!response || typeof response !== "object" || !Array.isArray((response as { output?: unknown }).output)) {
    throw new CliError("OpenAI planner response does not contain output text.");
  }
  const texts: string[] = [];
  for (const item of (response as { output: unknown[] }).output) {
    if (!item || typeof item !== "object" || !Array.isArray((item as { content?: unknown }).content)) {
      continue;
    }
    for (const content of (item as { content: unknown[] }).content) {
      if (content && typeof content === "object" && typeof (content as { text?: unknown }).text === "string") {
        texts.push((content as { text: string }).text);
      }
    }
  }
  if (texts.length === 0) {
    throw new CliError("OpenAI planner response does not contain output text.");
  }
  return texts.join("\n");
}

function extractChatText(response: unknown): string {
  if (!response || typeof response !== "object" || !Array.isArray((response as { choices?: unknown }).choices)) {
    throw new CliError("Chat planner response does not contain choices.");
  }
  const first = (response as { choices: unknown[] }).choices[0];
  if (!first || typeof first !== "object") {
    throw new CliError("Chat planner response does not contain a first choice.");
  }
  const message = (first as { message?: unknown }).message;
  if (!message || typeof message !== "object" || typeof (message as { content?: unknown }).content !== "string") {
    throw new CliError("Chat planner response does not contain message content.");
  }
  return (message as { content: string }).content;
}

function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new CliError("Planner did not return valid JSON content.");
  }
}

function isRetryable(error: unknown): boolean {
  if (!(error instanceof ImageApiError)) {
    return false;
  }
  if (!error.status) {
    return true;
  }
  return error.status === 408 || error.status === 409 || error.status === 425 || error.status === 429 || error.status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
