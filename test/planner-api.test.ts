import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { resolvePlannerProfile, suggestTemplatesWithPlanner } from "../src/planner-api.js";
import { normalizeAiRecommendations, suggestLocalTemplates } from "../src/suggest.js";
import type { Runtime } from "../src/io.js";

function sink(): Writable {
  return new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    }
  });
}

function runtimeWithFetch(fetchImpl: typeof fetch): Runtime {
  return {
    cwd: process.cwd(),
    env: {},
    stdin: process.stdin,
    stdout: sink(),
    stderr: sink(),
    fetchImpl
  };
}

describe("planner API", () => {
  it("uses OpenAI responses endpoint and validates recommendations", async () => {
    const requests: Array<{ url: string; body: unknown }> = [];
    const fetchImpl = (async (input, init) => {
      requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            recommendations: [
              {
                id: "mermaid-infographic",
                confidence: 0.92,
                reason: "Mermaid flow is a diagram source.",
                variables: { content: "flowchart LR" }
              }
            ]
          })
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }) as typeof fetch;

    const recommendations = await suggestTemplatesWithPlanner({
      brief: "flowchart LR A --> B",
      top: 3,
      options: resolvePlannerProfile("openai", { provider: "openai" }, "secret"),
      runtime: runtimeWithFetch(fetchImpl)
    });

    expect(requests[0]?.url).toBe("https://api.openai.com/v1/responses");
    expect((requests[0]?.body as { model?: string }).model).toBe("gpt-5.5");
    expect(recommendations[0]).toMatchObject({ id: "mermaid-infographic", title: "Mermaid 信息图重构" });
  });

  it("uses DeepSeek chat completions endpoint", async () => {
    const requests: Array<{ url: string; body: unknown }> = [];
    const fetchImpl = (async (input, init) => {
      requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  recommendations: [{ id: "city-line-poster", confidence: 0.86, reason: "City poster request.", variables: { theme: "杭州" } }]
                })
              }
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }) as typeof fetch;

    const recommendations = await suggestTemplatesWithPlanner({
      brief: "给杭州做城市海报",
      top: 2,
      options: resolvePlannerProfile("deepseek", { provider: "deepseek" }, "secret"),
      runtime: runtimeWithFetch(fetchImpl)
    });

    expect(requests[0]?.url).toBe("https://api.deepseek.com/chat/completions");
    expect((requests[0]?.body as { model?: string }).model).toBe("deepseek-v4-flash");
    expect(recommendations[0]?.id).toBe("city-line-poster");
  });

  it("rejects AI responses without valid template IDs", () => {
    expect(() =>
      normalizeAiRecommendations(
        {
          recommendations: [{ id: "not-a-template", confidence: 0.9, reason: "bad" }]
        },
        3
      )
    ).toThrow("AI planner did not return any valid template IDs");
  });

  it("matches local fallback rules for Mermaid briefs", () => {
    const recommendations = suggestLocalTemplates("flowchart LR A --> B", 2);
    expect(recommendations[0]?.id).toBe("mermaid-infographic");
  });
});
