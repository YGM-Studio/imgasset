import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PACKAGE_VERSION = readPackageVersion() || "0.0.0";
export const USER_AGENT = `imgasset/${PACKAGE_VERSION}`;

function readPackageVersion(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [resolve(here, "../package.json"), resolve(here, "../../package.json")];

  for (const candidate of candidates) {
    try {
      const value = JSON.parse(readFileSync(candidate, "utf8")) as { version?: unknown };
      if (typeof value.version === "string" && value.version.length > 0) {
        return value.version;
      }
    } catch {
      continue;
    }
  }

  return null;
}
