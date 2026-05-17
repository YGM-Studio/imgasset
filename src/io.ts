import type { Readable, Writable } from "node:stream";

export interface Runtime {
  cwd: string;
  env: NodeJS.ProcessEnv;
  stdin: Readable & {
    isTTY?: boolean;
    setRawMode?: (mode: boolean) => void;
    resume?: () => void;
    pause?: () => void;
    setEncoding?: (encoding: BufferEncoding) => void;
  };
  stdout: Writable;
  stderr: Writable;
  fetchImpl: typeof fetch;
}

export type RuntimeOverrides = Partial<Runtime>;

export function createRuntime(overrides: RuntimeOverrides = {}): Runtime {
  return {
    cwd: overrides.cwd || process.cwd(),
    env: overrides.env || process.env,
    stdin: overrides.stdin || process.stdin,
    stdout: overrides.stdout || process.stdout,
    stderr: overrides.stderr || process.stderr,
    fetchImpl: overrides.fetchImpl || globalThis.fetch
  };
}

export function writeLine(stream: Writable, text = ""): void {
  stream.write(`${text}\n`);
}
