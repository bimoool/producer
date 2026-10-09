import { describe, expect, it } from "vitest";
import { PERMISSIONS, WORKSPACE_ROLES, can } from "./permissions";

describe("матрица прав", () => {
  it("владелец может всё", () => {
    for (const p of PERMISSIONS) expect(can({ isOwner: true, role: null }, p)).toBe(true);
  });
  it("редактор: просмотр и работа, без управления", () => {
    expect(can({ isOwner: false, role: "editor" }, "workspace.view")).toBe(true);
    expect(can({ isOwner: false, role: "editor" }, "workspace.edit")).toBe(true);
    expect(can({ isOwner: false, role: "editor" }, "workspace.manage")).toBe(false);
  });
  it("просмотр/клиент: только просмотр", () => {
    expect(can({ isOwner: false, role: "viewer" }, "workspace.view")).toBe(true);
    expect(can({ isOwner: false, role: "viewer" }, "workspace.edit")).toBe(false);
    expect(can({ isOwner: false, role: "viewer" }, "workspace.manage")).toBe(false);
  });
  it("без роли — ничего", () => {
    for (const p of PERMISSIONS) expect(can({ isOwner: false, role: null }, p)).toBe(false);
  });
  it("роли MVP", () => expect([...WORKSPACE_ROLES]).toEqual(["editor", "viewer"]));
});
