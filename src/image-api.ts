import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import { ProxyAgent } from "undici";
import { CliError, ImageApiError } from "./errors.js";
import { writeLine } from "./io.js";
import { USER_AGENT } from "./package-info.js";
import { safeResolveInside } from "./paths.js";
import type { Runtime } from "./io.js";
import type { GeneratedImageResult, PromptJob, ResolvedGenerationOptions } from "./types.js";

export async function generateImages({
  jobs,
  options,
  runtime
}: {
  jobs: PromptJob[];
  options: ResolvedGenerationOptions;
  runtime: Runtime;
}): Promise<GeneratedImageResult[]> {
  const results: GeneratedImageResult[] = [];

  for (let index = 0; index < jobs.length; index += 1) {
    const job = jobs[index];
    if (!job) {
      continue;
    }

    const outputPath = safeResolveInside(options.rawDir, job.out);
    if (await exists(outputPath)) {
      if (options.skipExisting) {
        writeLine(runtime.stderr, `[${index + 1}/${jobs.length}] skipping existing ${outputPath}`);
        results.push({ out: job.out, rawPath: outputPath, status: "skipped", durationMs: 0 });
        continue;
      }
      if (!options.force) {
        throw new CliError(`Output already exists: ${outputPath} (use --force or --skip-existing).`);
      }
    }

    writeLine(runtime.stderr, `[${index + 1}/${jobs.length}] generating ${outputPath}`);
    const started = Date.now();
    const response = await requestWithRetries(job, options, runtime);
    const image = firstImageBytes(response);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, image);
    const durationMs = Date.now() - started;
    writeLine(runtime.stderr, `[${index + 1}/${jobs.length}] wrote ${outputPath} in ${(durationMs / 1000).toFixed(1)}s`);
    results.push({ out: job.out, rawPath: outputPath, status: "generated", durationMs });
  }

  return results;
}

async function requestWithRetries(job: PromptJob, options: ResolvedGenerationOptions, runtime: Runtime): Promise<unknown> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= options.retries + 1; attempt += 1) {
    try {
      return await requestImage(job, options, runtime);
    } catch (error) {
      lastError = error;
      if (attempt > options.retries || !isRetryable(error)) {
        break;
      }
      const sleepSeconds = retryDelaySeconds(error, attempt);
      writeLine(runtime.stderr, `attempt ${attempt} failed: ${error instanceof Error ? error.message : String(error)}; retrying in ${sleepSeconds}s`);
      await sleep(sleepSeconds * 1000);
    }
  }
  throw lastError;
}

async function requestImage(job: PromptJob, options: ResolvedGenerationOptions, runtime: Runtime): Promise<unknown> {
  if (hasReferenceInputs(job)) {
    return await requestImageEdit(job, options, runtime);
  }
  return await requestImageGeneration(job, options, runtime);
}

async function requestImageGeneration(job: PromptJob, options: ResolvedGenerationOptions, runtime: Runtime): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutSeconds * 1000);
  const endpoint = `${options.baseURL.replace(/\/+$/, "")}/images/generations`;
  const payload = {
    model: job.model || options.model,
    prompt: job.prompt,
    size: job.size || options.size,
    quality: job.quality || options.quality,
    n: job.n || 1,
    output_format: job.outputFormat || options.outputFormat
  };

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
      throw new ImageApiError(`HTTP ${response.status}: ${text}`, {
        status: response.status,
        retryAfter: parseRetryAfter(text)
      });
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new ImageApiError("Image API response is not valid JSON.");
    }
  } catch (error) {
    if (error instanceof ImageApiError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new ImageApiError(`Request timed out after ${options.timeoutSeconds}s.`);
    }
    throw new ImageApiError(error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(timeout);
  }
}

async function requestImageEdit(job: PromptJob, options: ResolvedGenerationOptions, runtime: Runtime): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutSeconds * 1000);
  const endpoint = `${options.baseURL.replace(/\/+$/, "")}/images/edits`;
  const form = new FormData();
  form.set("model", job.model || options.model);
  form.set("prompt", job.prompt);
  form.set("size", job.size || options.size);
  form.set("quality", job.quality || options.quality);
  form.set("n", String(job.n || 1));
  form.set("output_format", job.outputFormat || options.outputFormat);

  for (const image of job.images || []) {
    form.append("image", await fileBlob(resolve(runtime.cwd, image)), basename(image));
  }
  if (job.mask) {
    form.set("mask", await fileBlob(resolve(runtime.cwd, job.mask)), basename(job.mask));
  }

  const init: {
    method: string;
    headers: Record<string, string>;
    body: FormData;
    signal: AbortSignal;
    dispatcher?: unknown;
  } = {
    method: "POST",
    headers: {
      authorization: `Bearer ${options.apiKey}`,
      accept: "application/json",
      "user-agent": USER_AGENT
    },
    body: form,
    signal: controller.signal
  };
  if (options.proxy) {
    init.dispatcher = new ProxyAgent(options.proxy);
  }

  try {
    const response = await runtime.fetchImpl(endpoint, init as RequestInit);
    const text = await response.text();
    if (!response.ok) {
      throw new ImageApiError(`HTTP ${response.status}: ${text}`, {
        status: response.status,
        retryAfter: parseRetryAfter(text)
      });
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new ImageApiError("Image API response is not valid JSON.");
    }
  } catch (error) {
    if (error instanceof ImageApiError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new ImageApiError(`Request timed out after ${options.timeoutSeconds}s.`);
    }
    throw new ImageApiError(error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(timeout);
  }
}

export function parseRetryAfter(text: string): number | undefined {
  try {
    const body = JSON.parse(text) as { retry_after?: unknown };
    if (typeof body.retry_after === "number" && Number.isFinite(body.retry_after)) {
      return Math.max(0, Math.floor(body.retry_after));
    }
    if (typeof body.retry_after === "string" && /^\d+$/.test(body.retry_after)) {
      return Number(body.retry_after);
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function firstImageBytes(response: unknown): Buffer {
  if (!response || typeof response !== "object" || !("data" in response) || !Array.isArray(response.data)) {
    throw new ImageApiError("Image API response does not contain data.");
  }
  const first = response.data[0] as unknown;
  if (!first || typeof first !== "object" || !("b64_json" in first) || typeof first.b64_json !== "string") {
    throw new ImageApiError("Image API response does not contain b64_json.");
  }
  return Buffer.from(first.b64_json, "base64");
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

function retryDelaySeconds(error: unknown, attempt: number): number {
  const retryAfter = error instanceof ImageApiError ? error.retryAfter : undefined;
  return Math.min(180, retryAfter ?? Math.max(2, 2 ** attempt));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function hasReferenceInputs(job: PromptJob): boolean {
  return Boolean((job.images && job.images.length > 0) || job.mask);
}

async function fileBlob(path: string): Promise<Blob> {
  return new Blob([await readFile(path)], { type: mimeType(path) });
}

function mimeType(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".png":
    default:
      return "image/png";
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}
