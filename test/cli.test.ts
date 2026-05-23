import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

  it("renders a prompt template into a JSONL file", async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "imgasset-cli-"));
    const stdout = capture();
    const stderr = capture();
    await writeFile(resolve(tempDir, "flow.mmd"), "flowchart LR\n  A[写 prompts.jsonl] --> B[imgasset generate]\n");

    await expect(
      runCli(
        [
          "template",
          "use",
          "mermaid-infographic",
          "--var",
          "content=@flow.mmd",
          "--out",
          "article/flow.png",
          "--append",
          "prompts.jsonl"
        ],
        { cwd: tempDir, stdout: stdout.stream, stderr: stderr.stream }
      )
    ).resolves.toBe(0);

    const line = (await readFile(resolve(tempDir, "prompts.jsonl"), "utf8")).trim();
    const job = JSON.parse(line) as { out: string; prompt: string; size: string };
    expect(job.out).toBe("article/flow.png");
    expect(job.size).toBe("1536x1024");
    expect(job.prompt).toContain("flowchart LR");
  });

  it("can save planners, secrets, and list masked secret status", async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "imgasset-cli-"));
    const stdout = capture();
    const stderr = capture();
    const env = { IMGASSET_CONFIG_HOME: resolve(tempDir, "config") };

    await expect(
      runCli(["planner", "set", "deepseek", "--provider", "deepseek", "--default"], {
        env,
        stdout: stdout.stream,
        stderr: stderr.stream
      })
    ).resolves.toBe(0);
    await expect(
      runCli(["planner", "secret", "set", "deepseek", "--key", "sk-deepseek"], {
        env,
        stdout: stdout.stream,
        stderr: stderr.stream
      })
    ).resolves.toBe(0);
    await expect(runCli(["planner", "list"], { env, stdout: stdout.stream, stderr: stderr.stream })).resolves.toBe(0);

    const config = JSON.parse(await readFile(resolve(tempDir, "config/config.json"), "utf8"));
    const secrets = JSON.parse(await readFile(resolve(tempDir, "config/secrets.json"), "utf8"));
    expect(config.defaultPlanner).toBe("deepseek");
    expect(config.planners.deepseek.provider).toBe("deepseek");
    expect(secrets.planners.deepseek.apiKey).toBe("sk-deepseek");
    expect(stdout.text()).toContain("deepseek (default): provider=deepseek");
    expect(stdout.text()).toContain("secret=yes");
  });

  it("falls back to local template suggestions when no planner is configured", async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "imgasset-cli-"));
    const stdout = capture();
    const stderr = capture();
    const env = { IMGASSET_CONFIG_HOME: resolve(tempDir, "config") };

    await expect(
      runCli(["template", "suggest", "flowchart LR A --> B", "--json"], {
        env,
        stdout: stdout.stream,
        stderr: stderr.stream
      })
    ).resolves.toBe(0);

    const result = JSON.parse(stdout.text()) as { mode: string; fallbackReason: string; recommendations: Array<{ id: string }> };
    expect(result.mode).toBe("local");
    expect(result.fallbackReason).toContain("No default planner");
    expect(result.recommendations[0]?.id).toBe("mermaid-infographic");
    expect(stderr.text()).toContain("Using local template rules");
  });

  it("fails for an explicit planner without a key", async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "imgasset-cli-"));
    const stdout = capture();
    const stderr = capture();
    const env = { IMGASSET_CONFIG_HOME: resolve(tempDir, "config") };

    await expect(
      runCli(["planner", "set", "openai", "--provider", "openai"], {
        env,
        stdout: stdout.stream,
        stderr: stderr.stream
      })
    ).resolves.toBe(0);
    await expect(
      runCli(["template", "suggest", "Agent 架构头图", "--planner", "openai"], {
        env,
        stdout: stdout.stream,
        stderr: stderr.stream
      })
    ).resolves.toBe(1);
    expect(stderr.text()).toContain('No API key found for planner "openai"');
  });

  it("composes a prompt job and appends it to JSONL", async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "imgasset-cli-"));
    const stdout = capture();
    const stderr = capture();
    const env = { IMGASSET_CONFIG_HOME: resolve(tempDir, "config") };
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            templateId: "info-visual",
            prompt: "Create a premium editorial information visual about imgasset prompt workflows.",
            size: "1536x1024",
            reason: "The brief asks for an editorial visual."
          })
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )) as typeof fetch;

    await expect(
      runCli(["planner", "set", "openai", "--provider", "openai", "--default"], {
        env,
        stdout: stdout.stream,
        stderr: stderr.stream
      })
    ).resolves.toBe(0);
    await expect(
      runCli(["template", "compose", "imgasset prompt workflows", "--out", "article/visual.png", "--append", "prompts.jsonl"], {
        env: { ...env, OPENAI_API_KEY: "secret" },
        cwd: tempDir,
        stdout: stdout.stream,
        stderr: stderr.stream,
        fetchImpl
      })
    ).resolves.toBe(0);

    const line = (await readFile(resolve(tempDir, "prompts.jsonl"), "utf8")).trim();
    const job = JSON.parse(line) as { out: string; prompt: string; size: string };
    expect(job.out).toBe("article/visual.png");
    expect(job.prompt).toContain("premium editorial information visual");
    expect(job.size).toBe("1536x1024");
  });

  it("requires a planner for compose", async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "imgasset-cli-"));
    const stdout = capture();
    const stderr = capture();
    const env = { IMGASSET_CONFIG_HOME: resolve(tempDir, "config") };

    await expect(
      runCli(["template", "compose", "Agent 架构头图", "--out", "article/agent.png"], {
        env,
        stdout: stdout.stream,
        stderr: stderr.stream
      })
    ).resolves.toBe(1);
    expect(stderr.text()).toContain("No planner selected");
  });
});
