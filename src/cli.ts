import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { Command, CommanderError } from "commander";
import {
  configPath,
  pathExists,
  readAppConfig,
  readProjectConfig,
  readSecretConfig,
  resolveApiKey,
  secretsPath,
  validateProfile,
  writeAppConfig,
  writeSecretConfig,
  maskSecret
} from "./config.js";
import { compressImages, verifyTinify } from "./compress.js";
import { CliError, formatError } from "./errors.js";
import { generateImages } from "./image-api.js";
import { createRuntime, writeLine } from "./io.js";
import { readPromptJobs } from "./jsonl.js";
import { taskNameFromPromptPath } from "./paths.js";
import { printStoredSecret, readSecretValue } from "./secret-input.js";
import { DEFAULT_PROFILE } from "./types.js";
import type { Profile, ProjectConfig, ResolvedGenerationOptions } from "./types.js";
import type { Runtime, RuntimeOverrides } from "./io.js";

const VERSION = "0.1.0";

export async function runCli(argv: string[], overrides: RuntimeOverrides = {}): Promise<number> {
  const runtime = createRuntime(overrides);
  const program = createProgram(runtime);

  try {
    await program.parseAsync(argv, { from: "user" });
    return 0;
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode;
    }
    writeLine(runtime.stderr, formatError(error));
    return error instanceof CliError ? error.exitCode : 1;
  }
}

function createProgram(runtime: Runtime): Command {
  const program = new Command();
  program
    .name("imgasset")
    .description("Generate and compress image assets with an OpenAI-compatible image API.")
    .version(VERSION)
    .exitOverride()
    .configureOutput({
      writeOut: (text) => runtime.stdout.write(text),
      writeErr: (text) => runtime.stderr.write(text)
    });

  const config = program.command("config").description("Manage global imgasset config.");
  config
    .command("init")
    .description("Create global config and secret files if they do not exist.")
    .option("--force", "overwrite existing config")
    .action(async (options) => initConfig(runtime, Boolean(options.force)));

  const profile = program.command("profile").description("Manage image API profiles.");
  profile
    .command("set <name>")
    .description("Create or update a profile.")
    .option("--base-url <url>", "OpenAI-compatible base URL")
    .option("--model <model>", "image model name")
    .option("--size <size>", "image size, for example 1536x1024")
    .option("--quality <quality>", "image quality")
    .option("--output-format <format>", "API output format")
    .option("--proxy <url>", "HTTP proxy URL")
    .option("--timeout-seconds <seconds>", "request timeout in seconds", parseInteger)
    .option("--retries <count>", "retry count", parseInteger)
    .option("--default", "make this the default profile")
    .action(async (name, options) => setProfile(name, options, runtime));

  profile
    .command("list")
    .description("List saved profiles without printing secrets.")
    .action(async () => listProfiles(runtime));

  const secret = program.command("secret").description("Manage API secrets.");
  secret
    .command("set <profile>")
    .description("Store an API key for a profile outside project repositories.")
    .option("--key <key>", "API key; prefer interactive prompt or stdin for shell history safety")
    .action(async (profileName, options) => setSecret(profileName, options.key, runtime));

  secret
    .command("unset <profile>")
    .description("Remove an API key for a profile.")
    .action(async (profileName) => unsetSecret(profileName, runtime));

  program
    .command("generate <prompts>")
    .description("Generate raw images from a JSONL prompt file.")
    .option("--profile <name>", "profile name")
    .option("--raw-dir <dir>", "directory for generated originals")
    .option("--project-config <path>", "project config path", "imgasset.config.json")
    .option("--skip-existing", "skip existing raw outputs")
    .option("--force", "overwrite existing raw outputs")
    .action(async (prompts, options) => generateCommand(prompts, options, runtime));

  program
    .command("compress <input>")
    .description("Compress image files through bundled tinify-cli.")
    .option("--out-dir <dir>", "publish output directory")
    .option("--project-config <path>", "project config path", "imgasset.config.json")
    .option("--format <format>", "same, webp, avif, jpeg, png, or smallest")
    .option("--background <color>", "white, black, or #rrggbb")
    .option("--suffix <text>", "suffix before output extension")
    .option("--no-recursive", "do not walk directories recursively")
    .option("--tinify-key <key>", "Tinify API key for this command")
    .action(async (input, options) => compressCommand(input, options, runtime));

  program
    .command("run <prompts>")
    .description("Generate and compress images in one command.")
    .option("--profile <name>", "profile name")
    .option("--raw-dir <dir>", "directory for generated originals")
    .option("--publish-dir <dir>", "publish output directory")
    .option("--project-config <path>", "project config path", "imgasset.config.json")
    .option("--format <format>", "same, webp, avif, jpeg, png, or smallest")
    .option("--background <color>", "white, black, or #rrggbb")
    .option("--suffix <text>", "suffix before output extension")
    .option("--skip-existing", "skip existing raw outputs")
    .option("--force", "overwrite existing raw outputs")
    .option("--tinify-key <key>", "Tinify API key for this command")
    .action(async (prompts, options) => runCommand(prompts, options, runtime));

  program
    .command("doctor")
    .description("Check local configuration and tool readiness.")
    .option("--profile <name>", "profile name")
    .option("--project-config <path>", "project config path", "imgasset.config.json")
    .action(async (options) => doctorCommand(options, runtime));

  return program;
}

async function initConfig(runtime: Runtime, force: boolean): Promise<void> {
  const appPath = configPath(runtime.env);
  const secretPath = secretsPath(runtime.env);
  if (!force && (await pathExists(appPath))) {
    throw new CliError(`Config already exists at ${appPath}. Use --force to overwrite.`);
  }
  await writeAppConfig(appPath, { profiles: {} });
  if (!(await pathExists(secretPath))) {
    await writeSecretConfig(secretPath, { profiles: {} });
  }
  writeLine(runtime.stdout, `Config path: ${appPath}`);
  writeLine(runtime.stdout, `Secrets path: ${secretPath}`);
}

async function setProfile(name: string, options: Record<string, unknown>, runtime: Runtime): Promise<void> {
  const appPath = configPath(runtime.env);
  const config = await readAppConfig(appPath);
  const existing = config.profiles[name] || {};
  const next: Profile = {
    ...existing,
    ...stripUndefined({
      baseURL: stringOption(options.baseUrl),
      model: stringOption(options.model),
      size: stringOption(options.size),
      quality: stringOption(options.quality),
      outputFormat: stringOption(options.outputFormat),
      proxy: stringOption(options.proxy),
      timeoutSeconds: numberOption(options.timeoutSeconds),
      retries: numberOption(options.retries)
    })
  };
  config.profiles[name] = validateProfile(next);
  if (options.default || !config.defaultProfile) {
    config.defaultProfile = name;
  }
  await writeAppConfig(appPath, config);
  writeLine(runtime.stdout, `Saved profile "${name}" at ${appPath}.`);
}

async function listProfiles(runtime: Runtime): Promise<void> {
  const appPath = configPath(runtime.env);
  const secretPath = secretsPath(runtime.env);
  const config = await readAppConfig(appPath);
  const secrets = await readSecretConfig(secretPath);
  const names = Object.keys(config.profiles).sort();
  if (names.length === 0) {
    writeLine(runtime.stdout, "No profiles configured.");
    return;
  }
  for (const name of names) {
    const profile = config.profiles[name] || {};
    const defaultMark = config.defaultProfile === name ? " (default)" : "";
    const keyStatus = secrets.profiles[name]?.apiKey ? "yes" : "no";
    writeLine(
      runtime.stdout,
      `${name}${defaultMark}: baseURL=${profile.baseURL || DEFAULT_PROFILE.baseURL}, model=${profile.model || DEFAULT_PROFILE.model}, secret=${keyStatus}`
    );
  }
}

async function setSecret(profileName: string, keyOption: string | undefined, runtime: Runtime): Promise<void> {
  const secretPath = secretsPath(runtime.env);
  const key = keyOption || (await readSecretValue(runtime));
  if (!key) {
    throw new CliError("Provide an API key with --key, stdin, or the interactive prompt.");
  }
  const secrets = await readSecretConfig(secretPath);
  secrets.profiles[profileName] = { apiKey: key.trim() };
  await writeSecretConfig(secretPath, secrets);
  printStoredSecret(runtime, profileName, secretPath);
}

async function unsetSecret(profileName: string, runtime: Runtime): Promise<void> {
  const secretPath = secretsPath(runtime.env);
  const secrets = await readSecretConfig(secretPath);
  delete secrets.profiles[profileName];
  await writeSecretConfig(secretPath, secrets);
  writeLine(runtime.stdout, `Removed API key for profile "${profileName}".`);
}

async function generateCommand(prompts: string, options: Record<string, unknown>, runtime: Runtime): Promise<void> {
  const project = await loadProjectConfig(options, runtime);
  const jobs = await readPromptJobs(resolve(runtime.cwd, prompts));
  const generation = await resolveGeneration(prompts, options, project, runtime);
  const results = await generateImages({ jobs, options: generation, runtime });
  summarizeGeneration(results, runtime);
}

async function compressCommand(input: string, options: Record<string, unknown>, runtime: Runtime): Promise<void> {
  const project = await loadProjectConfig(options, runtime);
  const outDir = stringOption(options.outDir) || project.publishDir;
  if (!outDir) {
    throw new CliError("Missing publish output directory. Use --out-dir or project publishDir.");
  }
  await compressImages(
    {
      input: resolve(runtime.cwd, input),
      outDir: resolve(runtime.cwd, outDir),
      format: stringOption(options.format) || project.compress?.format || "jpeg",
      background: stringOption(options.background) || project.compress?.background || "white",
      suffix: options.suffix !== undefined ? String(options.suffix) : project.compress?.suffix ?? "",
      recursive: options.recursive !== false && project.compress?.recursive !== false,
      key: stringOption(options.tinifyKey)
    },
    runtime
  );
}

async function runCommand(prompts: string, options: Record<string, unknown>, runtime: Runtime): Promise<void> {
  const project = await loadProjectConfig(options, runtime);
  const jobs = await readPromptJobs(resolve(runtime.cwd, prompts));
  const generation = await resolveGeneration(prompts, options, project, runtime);
  const results = await generateImages({ jobs, options: generation, runtime });
  summarizeGeneration(results, runtime);

  const publishDir = stringOption(options.publishDir) || project.publishDir;
  if (!publishDir) {
    throw new CliError("Missing publish output directory. Use --publish-dir or project publishDir.");
  }

  await compressImages(
    {
      input: generation.rawDir,
      outDir: resolve(runtime.cwd, publishDir),
      format: stringOption(options.format) || project.compress?.format || "jpeg",
      background: stringOption(options.background) || project.compress?.background || "white",
      suffix: options.suffix !== undefined ? String(options.suffix) : project.compress?.suffix ?? "",
      recursive: project.compress?.recursive !== false,
      key: stringOption(options.tinifyKey)
    },
    runtime
  );
}

async function doctorCommand(options: Record<string, unknown>, runtime: Runtime): Promise<void> {
  const appPath = configPath(runtime.env);
  const secretPath = secretsPath(runtime.env);
  const project = await loadProjectConfig(options, runtime);
  const config = await readAppConfig(appPath);
  const secrets = await readSecretConfig(secretPath);
  const profileName = stringOption(options.profile) || project.profile || config.defaultProfile || "(none)";
  const profile = profileName === "(none)" ? null : config.profiles[profileName];
  const secret = profile ? resolveApiKey({ profileName, secrets, env: runtime.env }) : null;

  writeLine(runtime.stdout, `Node: ${process.version}`);
  writeLine(runtime.stdout, `Config path: ${appPath} (${(await pathExists(appPath)) ? "found" : "missing"})`);
  writeLine(runtime.stdout, `Secrets path: ${secretPath} (${(await pathExists(secretPath)) ? "found" : "missing"})`);
  writeLine(runtime.stdout, `Profile: ${profileName}${profile ? "" : " (missing)"}`);
  writeLine(runtime.stdout, `API key: ${maskSecret(secret)}`);
  writeLine(runtime.stdout, `Proxy: ${profile?.proxy || project.generation?.proxy || "(not set)"}`);
  writeLine(runtime.stdout, `tinify-cli: ${(await verifyTinify(runtime)) ? "ok" : "missing"}`);
}

async function resolveGeneration(
  prompts: string,
  options: Record<string, unknown>,
  project: ProjectConfig,
  runtime: Runtime
): Promise<ResolvedGenerationOptions> {
  const appPath = configPath(runtime.env);
  const secretPath = secretsPath(runtime.env);
  const config = await readAppConfig(appPath);
  const profileName = stringOption(options.profile) || project.profile || config.defaultProfile;
  if (!profileName) {
    throw new CliError("No profile selected. Use --profile or set a default profile.");
  }
  const profile = config.profiles[profileName];
  if (!profile) {
    throw new CliError(`Profile not found: ${profileName}`);
  }
  const secrets = await readSecretConfig(secretPath);
  const apiKey = resolveApiKey({ profileName, secrets, env: runtime.env });
  if (!apiKey) {
    throw new CliError(`No API key found for profile "${profileName}". Run imgasset secret set ${profileName}.`);
  }

  const merged: Profile = {
    ...DEFAULT_PROFILE,
    ...profile,
    ...project.generation
  };
  const rawDir =
    stringOption(options.rawDir) ||
    project.rawDir ||
    `temp/imgasset/${taskNameFromPromptPath(prompts)}/raw`;

  return {
    profileName,
    baseURL: merged.baseURL || DEFAULT_PROFILE.baseURL,
    model: merged.model || DEFAULT_PROFILE.model,
    size: merged.size || DEFAULT_PROFILE.size,
    quality: merged.quality || DEFAULT_PROFILE.quality,
    outputFormat: merged.outputFormat || DEFAULT_PROFILE.outputFormat,
    proxy: merged.proxy,
    timeoutSeconds: merged.timeoutSeconds || DEFAULT_PROFILE.timeoutSeconds,
    retries: merged.retries ?? DEFAULT_PROFILE.retries,
    apiKey,
    rawDir: resolve(runtime.cwd, rawDir),
    skipExisting: Boolean(options.skipExisting),
    force: Boolean(options.force)
  };
}

async function loadProjectConfig(options: Record<string, unknown>, runtime: Runtime): Promise<ProjectConfig> {
  const projectConfig = resolve(runtime.cwd, String(options.projectConfig || "imgasset.config.json"));
  try {
    await access(projectConfig);
  } catch {
    return {};
  }
  return await readProjectConfig(projectConfig);
}

function summarizeGeneration(results: Array<{ status: "generated" | "skipped" }>, runtime: Runtime): void {
  const generated = results.filter((result) => result.status === "generated").length;
  const skipped = results.filter((result) => result.status === "skipped").length;
  writeLine(runtime.stdout, `summary: generated ${generated}, skipped ${skipped}, failed 0`);
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}

function stringOption(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberOption(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function parseInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new CliError(`Expected an integer, got ${value}.`);
  }
  return parsed;
}
