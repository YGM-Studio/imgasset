import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readPromptJobs } from "../src/jsonl.js";

let tempDir: string | null = null;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

async function tempFile(contents: string): Promise<string> {
  tempDir = await mkdtemp(resolve(tmpdir(), "imgasset-jsonl-"));
  const path = resolve(tempDir, "prompts.jsonl");
  await writeFile(path, contents);
  return path;
}

describe("readPromptJobs", () => {
  it("parses JSONL prompt jobs and ignores blank lines/comments", async () => {
    const path = await tempFile(`
# comment
{"out":"article/01.png","prompt":"Generate a poster","quality":"medium"}

{"out":"article/02.png","prompt":"Generate another poster","images":["refs/source.jpg"],"mask":"refs/mask.png","n":1}
`);

    await expect(readPromptJobs(path)).resolves.toEqual([
      { out: "article/01.png", prompt: "Generate a poster", quality: "medium" },
      { out: "article/02.png", prompt: "Generate another poster", images: ["refs/source.jpg"], mask: "refs/mask.png", n: 1 }
    ]);
  });

  it("rejects unsafe output paths", async () => {
    const path = await tempFile(`{"out":"../secret.png","prompt":"Generate a poster"}\n`);
    await expect(readPromptJobs(path)).rejects.toThrow("out must not contain '..'");
  });

  it("rejects unsafe reference image paths", async () => {
    const path = await tempFile(`{"out":"safe.png","prompt":"Generate a poster","images":["../secret.png"]}\n`);
    await expect(readPromptJobs(path)).rejects.toThrow("images paths must not contain '..'");
  });
});
