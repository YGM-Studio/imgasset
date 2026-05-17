import { describe, expect, it } from "vitest";
import { maskSecret, resolveApiKey, validateProfile } from "../src/config.js";

describe("config helpers", () => {
  it("masks secrets without exposing the full value", () => {
    expect(maskSecret("sk-1234567890abcdef")).toBe("sk-1234********cdef");
    expect(maskSecret()).toBe("(not set)");
  });

  it("resolves API keys from env before stored secrets", () => {
    const key = resolveApiKey({
      profileName: "default",
      secrets: { profiles: { default: { apiKey: "stored" } } },
      env: { IMGASSET_API_KEY: "env" }
    });
    expect(key).toBe("env");
  });

  it("requires https base URLs", () => {
    expect(() => validateProfile({ baseURL: "http://example.com/v1" })).toThrow("baseURL must use https");
  });
});
