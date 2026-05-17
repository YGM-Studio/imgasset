import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { Writable } from "node:stream";
import { CliError } from "./errors.js";
import type { Runtime } from "./io.js";

export interface CompressOptions {
  input: string;
  outDir: string;
  format?: string;
  background?: string;
  suffix?: string;
  recursive?: boolean;
  key?: string;
}

export async function compressImages(options: CompressOptions, runtime: Runtime): Promise<void> {
  const tinifyBin = await resolveTinifyBin();
  const args = [tinifyBin, options.input];

  if (options.recursive !== false) {
    args.push("--recursive");
  }
  args.push("--out-dir", options.outDir);
  if (options.format) {
    args.push("--format", options.format);
  }
  if (options.background) {
    args.push("--background", options.background);
  }
  if (options.suffix !== undefined) {
    args.push("--suffix", options.suffix);
  }
  if (options.key) {
    args.push("--key", options.key);
  }

  await runNodeScript(args, runtime);
}

export async function verifyTinify(runtime: Runtime): Promise<boolean> {
  try {
    const tinifyBin = await resolveTinifyBin();
    await runNodeScript([tinifyBin, "--version"], {
      ...runtime,
      stdout: sink(),
      stderr: sink()
    });
    return true;
  } catch {
    return false;
  }
}

async function resolveTinifyBin(): Promise<string> {
  const require = createRequire(import.meta.url);
  let packagePath: string;
  try {
    packagePath = require.resolve("@yigemo/tinify-cli/package.json");
  } catch {
    throw new CliError("Cannot find @yigemo/tinify-cli. Reinstall imgasset dependencies.");
  }
  const packageJson = JSON.parse(await readFile(packagePath, "utf8")) as { bin?: Record<string, string> };
  const bin = packageJson.bin?.tinify || packageJson.bin?.["tinify-cli"];
  if (!bin) {
    throw new CliError("@yigemo/tinify-cli does not expose a tinify binary.");
  }
  return resolve(dirname(packagePath), bin);
}

function runNodeScript(args: string[], runtime: Runtime): Promise<void> {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: runtime.cwd,
      env: runtime.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    child.stdout.pipe(runtime.stdout, { end: false });
    child.stderr.pipe(runtime.stderr, { end: false });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolveRun();
      } else {
        reject(new CliError(`tinify-cli exited with code ${code ?? "unknown"}.`));
      }
    });
  });
}

function sink(): Writable {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    }
  });
}
