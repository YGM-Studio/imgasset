import { describe, expect, it } from "vitest";
import { getPromptTemplate, listPromptTemplates, renderPromptTemplate } from "../src/templates.js";

describe("prompt templates", () => {
  it("lists the built-in gallery", () => {
    const templates = listPromptTemplates();

    expect(templates.map((template) => template.id)).toContain("handdrawn-knowledge");
    expect(templates.map((template) => template.id)).toContain("mermaid-infographic");
    expect(templates.map((template) => template.id)).toContain("geometric-window-poetry-poster");
    expect(templates.map((template) => template.id)).toContain("scroll-beauty-poster");
    expect(templates.map((template) => template.id)).toContain("conceptual-logo");
    expect(templates.map((template) => template.id)).toContain("botanical-knowledge-card");
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

  it("renders newly collected templates", () => {
    expect(renderPromptTemplate("conceptual-logo", { brand: "墨屿 InkIsle" })).toContain("墨屿 InkIsle");
    expect(renderPromptTemplate("botanical-knowledge-card", { theme: "蓝雪花" })).toContain("蓝雪花");
    expect(renderPromptTemplate("geometric-window-poetry-poster", { theme: "接天莲叶无穷碧" })).toContain("接天莲叶无穷碧");
    expect(renderPromptTemplate("scroll-beauty-poster", { character: "月下仙子" })).toContain("月下仙子");
  });
});
