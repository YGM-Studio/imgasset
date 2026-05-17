import { resolve, sep } from "node:path";
import { CliError } from "./errors.js";

export function safeResolveInside(baseDir: string, relativePath: string): string {
  const base = resolve(baseDir);
  const target = resolve(base, relativePath);
  if (target !== base && !target.startsWith(`${base}${sep}`)) {
    throw new CliError(`Output path escapes base directory: ${relativePath}`);
  }
  return target;
}

export function taskNameFromPromptPath(path: string): string {
  const name = path.split(/[\\/]/).pop() || "task";
  return name.replace(/\.[^.]+$/, "") || "task";
}
