/**
 * Защита от регрессий: каждая страница приложения и каждое Server Action
 * обязаны вызывать серверную проверку прав. Новая страница без проверки — красный тест.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../src/app");
function files(dir: string, name: RegExp): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p, name) : name.test(f) ? [p] : [];
  });
}
const rel = (p: string) => path.relative(root, p);

describe("серверные проверки прав", () => {
  const pages = files(path.join(root, "(app)"), /^(page|layout)\.tsx$/);

  it("личные страницы вызывают ownerPage()", () => {
    const personal = pages.filter((p) => !rel(p).startsWith("(app)/projects") && !rel(p).startsWith("(app)/admin") && !/layout\.tsx$/.test(p));
    expect(personal.length).toBeGreaterThanOrEqual(9);
    for (const p of personal) expect(readFileSync(p, "utf8"), rel(p)).toMatch(/await ownerPage\(\)/);
  });

  it("страницы проекта вызывают workspacePage()", () => {
    const project = pages.filter((p) => rel(p).startsWith("(app)/projects/[slug]"));
    expect(project.length).toBeGreaterThanOrEqual(6);
    for (const p of project) expect(readFileSync(p, "utf8"), rel(p)).toMatch(/await workspacePage\(/);
  });

  it("администрирование — только владелец", () => {
    const admin = pages.filter((p) => rel(p).startsWith("(app)/admin"));
    expect(admin.length).toBeGreaterThan(0);
    for (const p of admin) expect(readFileSync(p, "utf8"), rel(p)).toMatch(/await ownerPage\(\)/);
  });

  it("каждое экспортируемое Server Action проверяет права до любого другого await", () => {
    for (const file of files(path.join(root, "actions"), /\.ts$/)) {
      const src = readFileSync(file, "utf8");
      const chunks = src.split(/(?=^export async function )/m).filter((c) => c.startsWith("export async function"));
      expect(chunks.length, rel(file)).toBeGreaterThan(0);
      for (const chunk of chunks) {
        const name = chunk.match(/^export async function (\w+)/)![1];
        const firstAwait = chunk.match(/await (\w+)\(/)?.[1];
        expect(firstAwait, `${rel(file)}: ${name}`).toMatch(/^(assertOwner|assertWorkspace)$/);
      }
    }
  });
});
