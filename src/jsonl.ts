import { readFile } from "node:fs/promises";
import { z } from "zod";
import { CliError } from "./errors.js";
import type { PromptJob } from "./types.js";

const promptJobSchema = z.object({
  out: z.string().min(1),
  prompt: z.string().min(1),
  model: z.string().min(1).optional(),
  size: z.string().min(1).optional(),
  quality: z.string().min(1).optional(),
  outputFormat: z.string().min(1).optional(),
  n: z.number().int().positive().optional()
});

export async function readPromptJobs(path: string): Promise<PromptJob[]> {
  const lines = (await readFile(path, "utf8")).split(/\r?\n/);
  const jobs: PromptJob[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index]?.trim() || "";
    if (!raw || raw.startsWith("#")) {
      continue;
    }

    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch (error) {
      throw new CliError(`${path}:${index + 1}: invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }

    const parsed = promptJobSchema.safeParse(value);
    if (!parsed.success) {
      throw new CliError(`${path}:${index + 1}: invalid prompt job: ${parsed.error.issues[0]?.message || "unknown error"}`);
    }
    assertSafeOutPath(path, index + 1, parsed.data.out);
    jobs.push(parsed.data);
  }

  if (jobs.length === 0) {
    throw new CliError(`No prompt jobs found in ${path}.`);
  }

  return jobs;
}

function assertSafeOutPath(file: string, line: number, out: string): void {
  if (out.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(out)) {
    throw new CliError(`${file}:${line}: out must be relative.`);
  }
  if (out.split(/[\\/]+/).includes("..")) {
    throw new CliError(`${file}:${line}: out must not contain '..'.`);
  }
}
