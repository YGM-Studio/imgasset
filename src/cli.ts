import { access, appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Command, CommanderError } from "commander";
import {
  configPath,
  pathExists,
  readAppConfig,
  readProjectConfig,
  readSecretConfig,
  resolveApiKey,
  resolvePlannerApiKey,
  secretsPath,
  validatePlannerProfile,
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
import { PACKAGE_VERSION } from "./package-info.js";
import { taskNameFromPromptPath } from "./paths.js";
import { resolvePlannerProfile, suggestTemplatesWithPlanner } from "./planner-api.js";
import { printStoredPlannerSecret, printStoredSecret, readSecretValue } from "./secret-input.js";
import { suggestLocalTemplates } from "./suggest.js";
import { getPromptTemplate, listPromptTemplates, renderPromptTemplate } from "./templates.js";
import { DEFAULT_PLANNER_PROFILES, DEFAULT_PROFILE } from "./types.js";
import type { PlannerProfile, PlannerProvider, Profile, ProjectConfig, PromptJob, ResolvedGenerationOptions } from "./types.js";
import type { Runtime, RuntimeOverrides } from "./io.js";
import type { SuggestResult, TemplateRecommendation } from "./suggest.js";

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
    .version(PACKAGE_VERSION)
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

  const planner = program.command("planner").description("Manage AI planner profiles for prompt template suggestions.");
  planner
    .command("set <name>")
    .description("Create or update an AI planner profile.")
    .requiredOption("--provider <provider>", "planner provider: openai or deepseek")
    .option("--base-url <url>", "planner API base URL")
    .option("--model <model>", "planner model name")
    .option("--proxy <url>", "HTTP proxy URL")
    .option("--timeout-seconds <seconds>", "request timeout in seconds", parseInteger)
    .option("--retries <count>", "retry count", parseInteger)
    .option("--default", "make this the default planner")
    .action(async (name, options) => setPlanner(name, options, runtime));

  planner
    .command("list")
    .description("List saved AI planner profiles without printing secrets.")
    .action(async () => listPlanners(runtime));

  const plannerSecret = planner.command("secret").description("Manage AI planner API secrets.");
  plannerSecret
    .command("set <planner>")
    .description("Store an API key for a planner outside project repositories.")
    .option("--key <key>", "API key; prefer interactive prompt or stdin for shell history safety")
    .action(async (plannerName, options) => setPlannerSecret(plannerName, options.key, runtime));

  plannerSecret
    .command("unset <planner>")
    .description("Remove an API key for a planner.")
    .action(async (plannerName) => unsetPlannerSecret(plannerName, runtime));

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

  const template = program.command("template").description("Browse and use built-in prompt templates.");
  template
    .command("list")
    .description("List built-in prompt templates.")
    .action(async () => listTemplates(runtime));

  template
    .command("show <id>")
    .description("Show a built-in prompt template.")
    .option("--prompt", "print only the raw prompt template")
    .action(async (id, options) => showTemplate(id, options, runtime));

  template
    .command("use <id>")
    .description("Render a built-in prompt template as a JSONL prompt job.")
    .requiredOption("--out <path>", "prompt job output path")
    .option("--var <name=value>", "template variable; use @path to read a file", collectOption, [])
    .option("--append <path>", "append the rendered prompt job to a JSONL file")
    .option("--model <model>", "prompt job model override")
    .option("--size <size>", "prompt job size override")
    .option("--quality <quality>", "prompt job quality override")
    .option("--output-format <format>", "prompt job output format override")
    .option("-n <count>", "number of images to generate", parseInteger)
    .action(async (id, options) => useTemplate(id, options, runtime));

  template
    .command("suggest <brief...>")
    .description("Recommend built-in prompt templates for a brief.")
    .option("--planner <name>", "AI planner profile name")
    .option("--local", "use local rules only")
    .option("--json", "print machine-readable JSON")
    .option("--top <count>", "maximum recommendations to return", parsePositiveInteger, 3)
    .action(async (briefParts, options) => suggestTemplate(briefParts, options, runtime));

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
  await writeAppConfig(appPath, { profiles: {}, planners: {} });
  if (!(await pathExists(secretPath))) {
    await writeSecretConfig(secretPath, { profiles: {}, planners: {} });
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

async function setPlanner(name: string, options: Record<string, unknown>, runtime: Runtime): Promise<void> {
  const provider = parsePlannerProvider(options.provider);
  const appPath = configPath(runtime.env);
  const config = await readAppConfig(appPath);
  const existing = config.planners[name] || { provider };
  if (existing.provider !== provider) {
    throw new CliError(`Planner "${name}" already uses provider ${existing.provider}. Create a new planner for ${provider}.`);
  }
  const next: PlannerProfile = {
    ...existing,
    ...stripUndefined({
      provider,
      baseURL: stringOption(options.baseUrl),
      model: stringOption(options.model),
      proxy: stringOption(options.proxy),
      timeoutSeconds: numberOption(options.timeoutSeconds),
      retries: numberOption(options.retries)
    })
  };
  config.planners[name] = validatePlannerProfile(next);
  if (options.default || !config.defaultPlanner) {
    config.defaultPlanner = name;
  }
  await writeAppConfig(appPath, config);
  writeLine(runtime.stdout, `Saved planner "${name}" at ${appPath}.`);
}

async function listPlanners(runtime: Runtime): Promise<void> {
  const appPath = configPath(runtime.env);
  const secretPath = secretsPath(runtime.env);
  const config = await readAppConfig(appPath);
  const secrets = await readSecretConfig(secretPath);
  const names = Object.keys(config.planners).sort();
  if (names.length === 0) {
    writeLine(runtime.stdout, "No planners configured.");
    return;
  }
  for (const name of names) {
    const planner = config.planners[name];
    if (!planner) {
      continue;
    }
    const defaults = DEFAULT_PLANNER_PROFILES[planner.provider];
    const defaultMark = config.defaultPlanner === name ? " (default)" : "";
    const keyStatus = resolvePlannerApiKey({ plannerName: name, provider: planner.provider, secrets, env: runtime.env }) ? "yes" : "no";
    writeLine(
      runtime.stdout,
      `${name}${defaultMark}: provider=${planner.provider}, baseURL=${planner.baseURL || defaults.baseURL}, model=${planner.model || defaults.model}, secret=${keyStatus}`
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

async function setPlannerSecret(plannerName: string, keyOption: string | undefined, runtime: Runtime): Promise<void> {
  const secretPath = secretsPath(runtime.env);
  const key = keyOption || (await readSecretValue(runtime));
  if (!key) {
    throw new CliError("Provide an API key with --key, stdin, or the interactive prompt.");
  }
  const secrets = await readSecretConfig(secretPath);
  secrets.planners[plannerName] = { apiKey: key.trim() };
  await writeSecretConfig(secretPath, secrets);
  printStoredPlannerSecret(runtime, plannerName, secretPath);
}

async function unsetPlannerSecret(plannerName: string, runtime: Runtime): Promise<void> {
  const secretPath = secretsPath(runtime.env);
  const secrets = await readSecretConfig(secretPath);
  delete secrets.planners[plannerName];
  await writeSecretConfig(secretPath, secrets);
  writeLine(runtime.stdout, `Removed API key for planner "${plannerName}".`);
}

async function listTemplates(runtime: Runtime): Promise<void> {
  for (const template of listPromptTemplates()) {
    const size = template.defaultSize ? ` size=${template.defaultSize}` : "";
    writeLine(runtime.stdout, `${template.id}: ${template.title}${size}`);
    writeLine(runtime.stdout, `  ${template.summary}`);
    writeLine(runtime.stdout, `  tags: ${template.tags.join(", ")}`);
  }
}

async function showTemplate(id: string, options: Record<string, unknown>, runtime: Runtime): Promise<void> {
  const template = getPromptTemplate(id);
  if (options.prompt) {
    writeLine(runtime.stdout, template.template);
    return;
  }

  writeLine(runtime.stdout, `${template.id}: ${template.title}`);
  writeLine(runtime.stdout, template.summary);
  writeLine(runtime.stdout, `version: ${template.version}`);
  writeLine(runtime.stdout, `source: ${template.source}`);
  if (template.defaultSize) {
    writeLine(runtime.stdout, `defaultSize: ${template.defaultSize}`);
  }
  writeLine(runtime.stdout, `tags: ${template.tags.join(", ")}`);
  writeLine(runtime.stdout, "inputs:");
  for (const input of template.inputs) {
    const required = input.required ? "required" : "optional";
    const defaultText = input.default !== undefined ? `, default=${input.default}` : "";
    writeLine(runtime.stdout, `  ${input.name}: ${input.label} (${required}${defaultText})`);
    if (input.description) {
      writeLine(runtime.stdout, `    ${input.description}`);
    }
  }
  writeLine(runtime.stdout, "");
  writeLine(runtime.stdout, template.template);
}

async function useTemplate(id: string, options: Record<string, unknown>, runtime: Runtime): Promise<void> {
  const values = await parseTemplateVariables(options.var, runtime);
  const template = getPromptTemplate(id);
  const prompt = renderPromptTemplate(id, values);
  const job: PromptJob = {
    out: String(options.out),
    prompt,
    ...stripUndefined({
      model: stringOption(options.model),
      size: stringOption(options.size) || template.defaultSize,
      quality: stringOption(options.quality) || template.defaultQuality,
      outputFormat: stringOption(options.outputFormat) || template.defaultOutputFormat,
      n: numberOption(options.n)
    })
  };
  const line = JSON.stringify(job);
  const appendPath = stringOption(options.append);
  if (!appendPath) {
    writeLine(runtime.stdout, line);
    return;
  }

  const target = resolve(runtime.cwd, appendPath);
  await mkdir(dirname(target), { recursive: true });
  await appendFile(target, `${line}\n`, "utf8");
  writeLine(runtime.stdout, `Appended prompt job to ${target}.`);
}

async function suggestTemplate(briefParts: string[], options: Record<string, unknown>, runtime: Runtime): Promise<void> {
  const brief = briefParts.join(" ").trim();
  if (!brief) {
    throw new CliError("Provide a brief to suggest templates for.");
  }
  const top = numberOption(options.top) || 3;
  const json = Boolean(options.json);
  const explicitPlanner = stringOption(options.planner);

  let result: SuggestResult;
  if (options.local) {
    result = {
      mode: "local",
      recommendations: suggestLocalTemplates(brief, top)
    };
  } else {
    const aiResult = await trySuggestWithPlanner({ brief, top, plannerName: explicitPlanner, runtime });
    if (aiResult) {
      result = aiResult;
    } else {
      const fallbackReason = "No default planner with API key found. Configure one with imgasset planner set <name> --provider openai --default and imgasset planner secret set <name>.";
      writeLine(runtime.stderr, `Using local template rules. ${fallbackReason}`);
      result = {
        mode: "local",
        fallbackReason,
        recommendations: suggestLocalTemplates(brief, top)
      };
    }
  }

  if (json) {
    writeLine(runtime.stdout, JSON.stringify(result, null, 2));
    return;
  }
  printSuggestResult(result, brief, runtime);
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

function parsePositiveInteger(value: string): number {
  const parsed = parseInteger(value);
  if (parsed <= 0) {
    throw new CliError(`Expected a positive integer, got ${value}.`);
  }
  return parsed;
}

function collectOption(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}

async function parseTemplateVariables(value: unknown, runtime: Runtime): Promise<Record<string, string>> {
  const entries = Array.isArray(value) ? value : [];
  const result: Record<string, string> = {};
  for (const entry of entries) {
    if (typeof entry !== "string") {
      continue;
    }
    const equalsIndex = entry.indexOf("=");
    if (equalsIndex <= 0) {
      throw new CliError(`Expected --var name=value, got ${entry}.`);
    }
    const name = entry.slice(0, equalsIndex);
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
      throw new CliError(`Invalid template variable name: ${name}`);
    }
    const rawValue = entry.slice(equalsIndex + 1);
    result[name] = rawValue.startsWith("@") ? await readTemplateVariableFile(rawValue.slice(1), runtime) : rawValue;
  }
  return result;
}

async function readTemplateVariableFile(path: string, runtime: Runtime): Promise<string> {
  if (!path) {
    throw new CliError("Expected a file path after @.");
  }
  return await readFile(resolve(runtime.cwd, path), "utf8");
}

function parsePlannerProvider(value: unknown): PlannerProvider {
  if (value === "openai" || value === "deepseek") {
    return value;
  }
  throw new CliError(`Unsupported planner provider: ${String(value)}. Use openai or deepseek.`);
}

async function trySuggestWithPlanner({
  brief,
  top,
  plannerName,
  runtime
}: {
  brief: string;
  top: number;
  plannerName?: string;
  runtime: Runtime;
}): Promise<SuggestResult | null> {
  const appPath = configPath(runtime.env);
  const secretPath = secretsPath(runtime.env);
  const config = await readAppConfig(appPath);
  const selected = plannerName || config.defaultPlanner;
  if (!selected) {
    return null;
  }
  const planner = config.planners[selected];
  if (!planner) {
    if (plannerName) {
      throw new CliError(`Planner not found: ${selected}`);
    }
    return null;
  }
  const secrets = await readSecretConfig(secretPath);
  const apiKey = resolvePlannerApiKey({ plannerName: selected, provider: planner.provider, secrets, env: runtime.env });
  if (!apiKey) {
    if (plannerName) {
      throw new CliError(`No API key found for planner "${selected}". Run imgasset planner secret set ${selected}.`);
    }
    return null;
  }
  const recommendations = await suggestTemplatesWithPlanner({
    brief,
    top,
    options: resolvePlannerProfile(selected, planner, apiKey),
    runtime
  });
  return {
    mode: "ai",
    planner: selected,
    recommendations
  };
}

function printSuggestResult(result: SuggestResult, brief: string, runtime: Runtime): void {
  const source = result.mode === "ai" ? `AI planner: ${result.planner}` : "Local rules";
  writeLine(runtime.stdout, `Template suggestions (${source})`);
  for (let index = 0; index < result.recommendations.length; index += 1) {
    const recommendation = result.recommendations[index];
    if (!recommendation) {
      continue;
    }
    writeLine(runtime.stdout, "");
    writeLine(runtime.stdout, `${index + 1}. ${recommendation.id} - ${recommendation.title} (${Math.round(recommendation.confidence * 100)}%)`);
    writeLine(runtime.stdout, `   ${recommendation.reason}`);
    const variableArgs = variableUseArgs(recommendation, brief);
    writeLine(runtime.stdout, `   Use: imgasset template use ${recommendation.id}${variableArgs} --out <path>`);
  }
}

function variableUseArgs(recommendation: TemplateRecommendation, brief: string): string {
  const template = getPromptTemplate(recommendation.id);
  const parts: string[] = [];
  for (const input of template.inputs) {
    if (!input.required && !recommendation.variables[input.name]) {
      continue;
    }
    const value = recommendation.variables[input.name] || brief;
    const printable = value.includes("\n") || value.length > 80 ? `<${input.name}>` : value;
    parts.push(` --var ${input.name}=${shellQuote(printable)}`);
  }
  return parts.join("");
}

function shellQuote(value: string): string {
  if (/^[a-zA-Z0-9_./:@-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, "'\\''")}'`;
}
