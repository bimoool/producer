/** Изоляция проектов, вход, немедленный отзыв доступа и блокировка. Требует DATABASE_URL. */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authorizeWorkspace, listWorkspacesFor, loginDecision, resolveViewer, type Viewer } from "@/lib/authz";
import { revokeSession } from "@/lib/session";
import { makeFixture } from "./helpers/auth-fixture";

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;

d("авторизация Producer OS", () => {
  let f: Awaited<ReturnType<typeof makeFixture>>;
  beforeAll(async () => {
    f = await makeFixture(url!);
  });
  afterAll(async () => f?.cleanup());

  const viewer = async (t: string) => (await resolveViewer(t)) as Viewer;

  it("владелец входит, существующая сессия владельца работает (обратная совместимость)", async () => {
    expect(await loginDecision(f.ownerTelegramId)).toBe("owner");
    const v = await viewer(f.tokens.owner);
    expect(v.isOwner).toBe(true);
  });

  it("вход: участник — да; без доступа, заблокированный, неизвестный — нет", async () => {
    expect(await loginDecision(f.ids.vera)).toBe("member");
    expect(await loginDecision(f.ids.stranger)).toBe("forbidden");
    expect(await loginDecision(f.ids.blocked)).toBe("forbidden");
    expect(await loginDecision(123)).toBe("forbidden");
  });

  it("сессии: без доступа и заблокированный — недействительны", async () => {
    expect(await resolveViewer(f.tokens.stranger)).toBeNull();
    expect(await resolveViewer(f.tokens.blocked)).toBeNull();
    expect(await resolveViewer("forged-token")).toBeNull();
  });

  it("Вера видит только свой проект", async () => {
    const v = await viewer(f.tokens.vera);
    expect(v.isOwner).toBe(false);
    const list = await listWorkspacesFor(v);
    expect(list.map((x) => x.workspace.slug)).toEqual(["vera"]);
    expect(await authorizeWorkspace(v, { slug: "vera" }, "workspace.view")).not.toBeNull();
    expect(await authorizeWorkspace(v, { slug: "my-content" }, "workspace.view")).toBeNull();
    expect(await authorizeWorkspace(v, { id: f.ws["my-content"] }, "workspace.view")).toBeNull();
    expect(await authorizeWorkspace(v, { slug: "vera" }, "workspace.edit")).toBeNull();
    expect(await authorizeWorkspace(v, { slug: "vera" }, "workspace.manage")).toBeNull();
  });

  it("редактор работает с проектом, но не управляет им", async () => {
    const v = await viewer(f.tokens.editor);
    expect(await authorizeWorkspace(v, { slug: "vera" }, "workspace.edit")).not.toBeNull();
    expect(await authorizeWorkspace(v, { slug: "vera" }, "workspace.manage")).toBeNull();
    expect(await authorizeWorkspace(v, { slug: "my-content" }, "workspace.view")).toBeNull();
  });

  it("владелец видит все проекты", async () => {
    const v = await viewer(f.tokens.owner);
    const slugs = (await listWorkspacesFor(v)).map((x) => x.workspace.slug);
    expect(slugs).toEqual(expect.arrayContaining(["vera", "my-content"]));
    expect(await authorizeWorkspace(v, { slug: "my-content" }, "workspace.manage")).not.toBeNull();
  });

  it("смена роли действует сразу", async () => {
    await f.sql`update workspace_members set role = 'editor' where user_id = ${f.user.vera}`;
    expect(await authorizeWorkspace(await viewer(f.tokens.vera), { slug: "vera" }, "workspace.edit")).not.toBeNull();
    await f.sql`update workspace_members set role = 'viewer' where user_id = ${f.user.vera}`;
    expect(await authorizeWorkspace(await viewer(f.tokens.vera), { slug: "vera" }, "workspace.edit")).toBeNull();
  });

  it("отзыв доступа прекращает доступ на следующем запросе (без выхода)", async () => {
    const before = await viewer(f.tokens.editor);
    expect(await authorizeWorkspace(before, { slug: "vera" }, "workspace.view")).not.toBeNull();
    await f.sql`update workspace_members set revoked_at = now() where user_id = ${f.user.editor}`;
    // последний доступ отозван → сессия больше не действует вовсе
    expect(await resolveViewer(f.tokens.editor)).toBeNull();
    // даже если держать старый объект Viewer — проверка проекта всё равно откажет
    expect(await authorizeWorkspace(before, { slug: "vera" }, "workspace.view")).toBeNull();
    expect(await loginDecision(f.ids.editor)).toBe("forbidden");
  });

  it("блокировка пользователя прекращает доступ сразу", async () => {
    expect(await resolveViewer(f.tokens.vera)).not.toBeNull();
    await f.sql`update users set disabled_at = now() where id = ${f.user.vera}`;
    expect(await resolveViewer(f.tokens.vera)).toBeNull();
    await f.sql`update users set disabled_at = null where id = ${f.user.vera}`;
    expect(await resolveViewer(f.tokens.vera)).not.toBeNull();
  });

  it("архивный проект недоступен даже владельцу через authorize", async () => {
    await f.sql`insert into workspaces (slug, title, archived_at) values ('t-archived', 'Архив', now())`;
    const v = await viewer(f.tokens.owner);
    expect(await authorizeWorkspace(v, { slug: "t-archived" }, "workspace.view")).toBeNull();
  });

  it("выход отзывает сессию", async () => {
    await revokeSession(f.tokens.stranger);
    expect(await resolveViewer(f.tokens.stranger)).toBeNull();
  });

  it("нельзя отключить единственного владельца (триггер БД)", async () => {
    await expect(f.sql`update users set disabled_at = now() where is_owner`).rejects.toThrow(/LAST_OWNER/);
    await expect(f.sql`update users set is_owner = false where is_owner`).rejects.toThrow(/LAST_OWNER/);
  });
});
