import { chmod, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { CliError } from "./errors.js";
import type { AppConfig, PlannerProfile, PlannerProvider, Profile, ProjectConfig, SecretConfig } from "./types.js";

const profileSchema = z.object({
  baseURL: z.string().url().optional(),
  model: z.string().min(1).optional(),
  size: z.string().min(1).optional(),
  quality: z.string().min(1).optional(),
  outputFormat: z.string().min(1).optional(),
  proxy: z.string().min(1).optional(),
  timeoutSeconds: z.number().int().positive().optional(),
  retries: z.number().int().min(0).optional()
});

const plannerProviderSchema = z.enum(["openai", "deepseek"]);

const plannerProfileSchema = z.object({
  provider: plannerProviderSchema,
  baseURL: z.string().url().optional(),
  model: z.string().min(1).optional(),
  proxy: z.string().min(1).optional(),
  timeoutSeconds: z.number().int().positive().optional(),
  retries: z.number().int().min(0).optional()
});

const appConfigSchema = z.object({
  defaultProfile: z.string().min(1).optional(),
  profiles: z.record(z.string(), profileSchema).default({}),
  defaultPlanner: z.string().min(1).optional(),
  planners: z.record(z.string(), plannerProfileSchema).default({})
});

const secretConfigSchema = z.object({
  profiles: z.record(z.string(), z.object({ apiKey: z.string().min(1) })).default({}),
  planners: z.record(z.string(), z.object({ apiKey: z.string().min(1) })).default({})
});

const projectConfigSchema = z.object({
  profile: z.string().min(1).optional(),
  rawDir: z.string().min(1).optional(),
  publishDir: z.string().min(1).optional(),
  generation: profileSchema.optional(),
  compress: z
    .object({
      format: z.string().min(1).optional(),
      background: z.string().min(1).optional(),
      suffix: z.string().optional(),
      recursive: z.boolean().optional()
    })
    .optional()
});

export function configRoot(env: NodeJS.ProcessEnv = process.env): string {
  if (env.IMGASSET_CONFIG_HOME) {
    return resolve(env.IMGASSET_CONFIG_HOME);
  }
  return resolve(env.XDG_CONFIG_HOME || resolve(homedir(), ".config"), "imgasset");
}

export function configPath(env: NodeJS.ProcessEnv = process.env): string {
  return resolve(env.IMGASSET_CONFIG || resolve(configRoot(env), "config.json"));
}

export function secretsPath(env: NodeJS.ProcessEnv = process.env): string {
  return resolve(env.IMGASSET_SECRETS || resolve(configRoot(env), "secrets.json"));
}

export async function readAppConfig(path: string): Promise<AppConfig> {
  const value = await readJson(path, { profiles: {}, planners: {} });
  return appConfigSchema.parse(value);
}

export async function writeAppConfig(path: string, config: AppConfig): Promise<void> {
  await writeJson(path, appConfigSchema.parse(config), 0o644);
}

export async function readSecretConfig(path: string): Promise<SecretConfig> {
  const value = await readJson(path, { profiles: {}, planners: {} });
  return secretConfigSchema.parse(value);
}

export async function writeSecretConfig(path: string, config: SecretConfig): Promise<void> {
  await writeJson(path, secretConfigSchema.parse(config), 0o600);
}

export async function readProjectConfig(path: string): Promise<ProjectConfig> {
  const value = await readJson(path, null);
  if (value === null) {
    return {};
  }
  return projectConfigSchema.parse(value);
}

export async function removeSecrets(path: string): Promise<void> {
  await rm(path, { force: true });
}

export function validateProfile(profile: Profile): Profile {
  const parsed = profileSchema.parse(profile);
  if (parsed.baseURL && !parsed.baseURL.startsWith("https://")) {
    throw new CliError("baseURL must use https.");
  }
  return parsed;
}

export function validatePlannerProfile(profile: PlannerProfile): PlannerProfile {
  const parsed = plannerProfileSchema.parse(profile);
  if (parsed.baseURL && !parsed.baseURL.startsWith("https://")) {
    throw new CliError("baseURL must use https.");
  }
  return parsed;
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export function maskSecret(secret?: string | null): string {
  if (!secret) {
    return "(not set)";
  }
  if (secret.length <= 8) {
    return `${secret.slice(0, 1)}***${secret.slice(-1)}`;
  }
  return `${secret.slice(0, 7)}${"*".repeat(Math.min(12, Math.max(0, secret.length - 11)))}${secret.slice(-4)}`;
}

export function resolveApiKey({
  profileName,
  secrets,
  env
}: {
  profileName: string;
  secrets: SecretConfig;
  env: NodeJS.ProcessEnv;
}): string | null {
  return env.IMGASSET_API_KEY || env.OPENAI_API_KEY || secrets.profiles[profileName]?.apiKey || null;
}

export function resolvePlannerApiKey({
  plannerName,
  provider,
  secrets,
  env
}: {
  plannerName: string;
  provider: PlannerProvider;
  secrets: SecretConfig;
  env: NodeJS.ProcessEnv;
}): string | null {
  const providerKey = provider === "openai" ? env.OPENAI_API_KEY : env.DEEPSEEK_API_KEY;
  return env.IMGASSET_PLANNER_API_KEY || providerKey || secrets.planners[plannerName]?.apiKey || null;
}

async function readJson(path: string, fallback: unknown): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return fallback;
    }
    if (error instanceof SyntaxError) {
      throw new CliError(`Invalid JSON at ${path}.`);
    }
    throw error;
  }
}

async function writeJson(path: string, value: unknown, mode: number): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { mode });
  await chmod(path, mode).catch(() => {});
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
