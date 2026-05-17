import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Writable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { generateImages, parseRetryAfter } from "../src/image-api.js";
import type { Runtime } from "../src/io.js";

let tempDir: string | null = null;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

function sink(): Writable {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    }
  });
}

describe("image API", () => {
  it("parses retry_after from JSON responses", () => {
    expect(parseRetryAfter('{"retry_after":120}')).toBe(120);
    expect(parseRetryAfter('{"retry_after":"30"}')).toBe(30);
    expect(parseRetryAfter("{}")).toBeUndefined();
  });

  it("generates images from b64_json responses", async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "imgasset-generate-"));
    const body = Buffer.from("image-bytes").toString("base64");
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ data: [{ b64_json: body }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })) as typeof fetch;
    const runtime: Runtime = {
      cwd: tempDir,
      env: {},
      stdin: process.stdin,
      stdout: sink(),
      stderr: sink(),
      fetchImpl
    };

    const results = await generateImages({
      jobs: [{ out: "nested/hero.png", prompt: "hero" }],
      options: {
        profileName: "test",
        baseURL: "https://example.com/v1",
        model: "gpt-image-2",
        size: "1536x1024",
        quality: "medium",
        outputFormat: "png",
        timeoutSeconds: 10,
        retries: 0,
        apiKey: "secret",
        rawDir: tempDir,
        skipExisting: false,
        force: false
      },
      runtime
    });

    expect(results[0]?.status).toBe("generated");
    await expect(readFile(resolve(tempDir, "nested/hero.png"), "utf8")).resolves.toBe("image-bytes");
  });
});
