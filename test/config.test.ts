import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { maskSecret, readAppConfig, readSecretConfig, resolveApiKey, resolvePlannerApiKey, validatePlannerProfile, validateProfile } from "../src/config.js";

let tempDir: string | null = null;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe("config helpers", () => {
  it("masks secrets without exposing the full value", () => {
    expect(maskSecret("sk-1234567890abcdef")).toBe("sk-1234********cdef");
    expect(maskSecret()).toBe("(not set)");
  });

  it("resolves API keys from env before stored secrets", () => {
    const key = resolveApiKey({
      profileName: "default",
      secrets: { profiles: { default: { apiKey: "stored" } }, planners: {} },
      env: { IMGASSET_API_KEY: "env" }
    });
    expect(key).toBe("env");
  });

  it("resolves planner API keys without using image API key env", () => {
    const key = resolvePlannerApiKey({
      plannerName: "writer",
      provider: "deepseek",
      secrets: { profiles: {}, planners: { writer: { apiKey: "stored" } } },
      env: { IMGASSET_API_KEY: "image", DEEPSEEK_API_KEY: "deepseek" }
    });
    expect(key).toBe("deepseek");

    const override = resolvePlannerApiKey({
      plannerName: "writer",
      provider: "deepseek",
      secrets: { profiles: {}, planners: { writer: { apiKey: "stored" } } },
      env: { IMGASSET_PLANNER_API_KEY: "planner", DEEPSEEK_API_KEY: "deepseek" }
    });
    expect(override).toBe("planner");
  });

  it("requires https base URLs", () => {
    expect(() => validateProfile({ baseURL: "http://example.com/v1" })).toThrow("baseURL must use https");
    expect(() => validatePlannerProfile({ provider: "openai", baseURL: "http://example.com/v1" })).toThrow("baseURL must use https");
  });

  it("parses old config and secret files without planner fields", async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), "imgasset-config-"));
    const configPath = resolve(tempDir, "config.json");
    const secretsPath = resolve(tempDir, "secrets.json");
    await writeFile(configPath, JSON.stringify({ profiles: { default: { model: "gpt-image-2" } } }));
    await writeFile(secretsPath, JSON.stringify({ profiles: { default: { apiKey: "stored" } } }));

    await expect(readAppConfig(configPath)).resolves.toMatchObject({
      profiles: { default: { model: "gpt-image-2" } },
      planners: {}
    });
    await expect(readSecretConfig(secretsPath)).resolves.toEqual({
      profiles: { default: { apiKey: "stored" } },
      planners: {}
    });
  });
});
