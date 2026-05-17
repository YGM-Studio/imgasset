import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Writable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../src/cli.js";

let tempDir: string | null = null;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

function capture(): { stream: Writable; text: () => string } {
  const chunks: Buffer[] = [];
  return {
    stream: new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      }
    }),
    text: () => Buffer.concat(chunks).toString("utf8")
  };
}

describe("CLI", () => {
  it("can initialize config and save a profile", async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "imgasset-cli-"));
    const stdout = capture();
    const stderr = capture();
    const env = { IMGASSET_CONFIG_HOME: resolve(tempDir, "config") };

    await expect(runCli(["config", "init"], { env, stdout: stdout.stream, stderr: stderr.stream })).resolves.toBe(0);
    await expect(
      runCli(
        [
          "profile",
          "set",
          "default",
          "--base-url",
          "https://api.example.com/v1",
          "--model",
          "gpt-image-2",
          "--default"
        ],
        { env, stdout: stdout.stream, stderr: stderr.stream }
      )
    ).resolves.toBe(0);

    const config = JSON.parse(await readFile(resolve(tempDir, "config/config.json"), "utf8"));
    expect(config.defaultProfile).toBe("default");
    expect(config.profiles.default.model).toBe("gpt-image-2");
  });
});
