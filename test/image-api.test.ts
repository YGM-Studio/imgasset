import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

  it("uses image edits multipart requests when reference images are present", async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "imgasset-edit-"));
    await writeFile(resolve(tempDir, "reference.png"), "reference-bytes");
    const body = Buffer.from("edited-image-bytes").toString("base64");
    const requests: Array<{ url: string; body: unknown }> = [];
    const fetchImpl = (async (input, init) => {
      requests.push({ url: String(input), body: init?.body });
      return new Response(JSON.stringify({ data: [{ b64_json: body }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }) as typeof fetch;
    const runtime: Runtime = {
      cwd: tempDir,
      env: {},
      stdin: process.stdin,
      stdout: sink(),
      stderr: sink(),
      fetchImpl
    };

    await generateImages({
      jobs: [{ out: "edited.png", prompt: "make a doodle", images: ["reference.png"] }],
      options: {
        profileName: "test",
        baseURL: "https://example.com/v1",
        model: "gpt-image-2",
        size: "1024x1024",
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

    expect(requests[0]?.url).toBe("https://example.com/v1/images/edits");
    expect(requests[0]?.body).toBeInstanceOf(FormData);
    const form = requests[0]?.body as FormData;
    expect(form.get("model")).toBe("gpt-image-2");
    expect(form.get("prompt")).toBe("make a doodle");
    expect(form.get("image")).toBeInstanceOf(File);
    await expect(readFile(resolve(tempDir, "edited.png"), "utf8")).resolves.toBe("edited-image-bytes");
  });
});
