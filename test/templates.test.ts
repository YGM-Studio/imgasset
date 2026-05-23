import { describe, expect, it } from "vitest";
import { getPromptTemplate, listPromptTemplates, renderPromptTemplate } from "../src/templates.js";

describe("prompt templates", () => {
  it("lists the built-in gallery", () => {
    const templates = listPromptTemplates();

    expect(templates.map((template) => template.id)).toContain("handdrawn-knowledge");
    expect(templates.map((template) => template.id)).toContain("mermaid-infographic");
    expect(getPromptTemplate("city-line-poster").defaultSize).toBe("1024x1536");
  });

  it("renders a template with required and default variables", () => {
    const prompt = renderPromptTemplate("handdrawn-knowledge", {
      content: "Hermes Agent 架构总览"
    });

    expect(prompt).toContain("Hermes Agent 架构总览");
    expect(prompt).toContain("比例：16:9");
  });

  it("rejects missing required variables", () => {
    expect(() => renderPromptTemplate("handdrawn-knowledge", {})).toThrow('Missing required template variable "content"');
  });
});
