import { writeLine } from "./io.js";
import type { Runtime } from "./io.js";

export async function readSecretValue(runtime: Runtime, prompt = "API key: "): Promise<string | null> {
  if (!runtime.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of runtime.stdin) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf8").trim() || null;
  }

  const setRawMode = runtime.stdin.setRawMode?.bind(runtime.stdin);
  if (!setRawMode) {
    return null;
  }

  runtime.stdout.write(prompt);
  return await new Promise((resolve, reject) => {
    let value = "";
    const stdin = runtime.stdin;

    const cleanup = (): void => {
      stdin.off("data", onData);
      setRawMode(false);
      stdin.pause?.();
      runtime.stdout.write("\n");
    };

    const onData = (chunk: Buffer | string): void => {
      const text = chunk.toString("utf8");
      for (const char of text) {
        if (char === "\u0003") {
          cleanup();
          reject(new Error("Canceled."));
          return;
        }
        if (char === "\r" || char === "\n") {
          cleanup();
          resolve(value.trim() || null);
          return;
        }
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        value += char;
      }
    };

    stdin.setEncoding?.("utf8");
    setRawMode(true);
    stdin.resume?.();
    stdin.on("data", onData);
  });
}

export function printStoredSecret(runtime: Runtime, profile: string, path: string): void {
  writeLine(runtime.stdout, `Stored API key for profile "${profile}" at ${path}.`);
}

export function printStoredPlannerSecret(runtime: Runtime, planner: string, path: string): void {
  writeLine(runtime.stdout, `Stored API key for planner "${planner}" at ${path}.`);
}
