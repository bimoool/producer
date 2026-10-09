"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addUser,
  changeRole,
  createWorkspace,
  grantAccess,
  revokeAccess,
  saveWorkspaceSheet,
  setUserBlocked,
  type ActionResult,
} from "@/app/actions/workspaces";
import { ConfirmAction } from "@/components/app/confirm-delete";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ROLE_LABELS, WORKSPACE_ROLES, type WorkspaceRole } from "@/lib/permissions";
import { useFormAction } from "./use-action";

type Option = { id: string; title: string };

function RoleSelect({ name = "role", defaultValue = "viewer", id }: { name?: string; defaultValue?: string; id?: string }) {
  return (
    <NativeSelect id={id} name={name} defaultValue={defaultValue}>
      {WORKSPACE_ROLES.map((r) => (
        <NativeSelectOption key={r} value={r}>
          {ROLE_LABELS[r]}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

export function CreateWorkspaceDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { formAction, pending } = useFormAction(createWorkspace, {
    success: "Проект создан",
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый проект</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ws-title">Название</Label>
            <Input id="ws-title" name="title" required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ws-slug">Адрес (латиница)</Label>
            <Input id="ws-slug" name="slug" required placeholder="например: anna" autoCapitalize="none" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ws-kind">Тип</Label>
            <NativeSelect id="ws-kind" name="kind" defaultValue="client">
              <NativeSelectOption value="client">Клиентский</NativeSelectOption>
              <NativeSelectOption value="personal">Личный</NativeSelectOption>
            </NativeSelect>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Создать
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SheetForm({ workspaceId, sheetUrl }: { workspaceId: string; sheetUrl: string | null }) {
  const { formAction, pending } = useFormAction(saveWorkspaceSheet, { success: "Сохранено" });
  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <Label htmlFor="sheet-url">Ссылка на Google-таблицу проекта</Label>
      <Input
        id="sheet-url"
        name="sheetUrl"
        inputMode="url"
        autoCapitalize="none"
        placeholder="https://docs.google.com/spreadsheets/d/…"
        defaultValue={sheetUrl ?? ""}
      />
      <p className="text-xs text-muted-foreground">Пока сохраняется только ссылка. Импорт показателей — в следующих спринтах.</p>
      <Button type="submit" disabled={pending} className="justify-self-start">
        Сохранить
      </Button>
    </form>
  );
}

/** Добавить пользователя по Telegram ID (и сразу дать доступ к проекту). */
export function AddUserForm({ workspaces, fixedWorkspaceId }: { workspaces: Option[]; fixedWorkspaceId?: string }) {
  const [key, setKey] = useState(0);
  const { formAction, pending } = useFormAction(addUser, { success: "Пользователь добавлен", onSuccess: () => setKey((k) => k + 1) });
  return (
    <form key={key} action={formAction} className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="u-tg">Telegram ID</Label>
          <Input id="u-tg" name="telegramId" inputMode="numeric" required placeholder="123456789" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="u-name">Имя</Label>
          <Input id="u-name" name="displayName" required />
        </div>
      </div>
      {fixedWorkspaceId ? (
        <input type="hidden" name="workspaceId" value={fixedWorkspaceId} />
      ) : (
        <div className="grid gap-1.5">
          <Label htmlFor="u-ws">Проект</Label>
          <NativeSelect id="u-ws" name="workspaceId" defaultValue="none">
            <NativeSelectOption value="none">— пока без доступа —</NativeSelectOption>
            {workspaces.map((w) => (
              <NativeSelectOption key={w.id} value={w.id}>
                {w.title}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="u-role">Роль</Label>
        <RoleSelect id="u-role" />
      </div>
      <p className="text-xs text-muted-foreground">Telegram ID — число, его можно узнать у @userinfobot.</p>
      <Button type="submit" disabled={pending} className="justify-self-start">
        Добавить
      </Button>
    </form>
  );
}

/** Выдать доступ существующему пользователю. */
export function GrantAccessForm({ userId, workspaces }: { userId: string; workspaces: Option[] }) {
  const { formAction, pending } = useFormAction(grantAccess, { success: "Доступ выдан" });
  if (workspaces.length === 0) return null;
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="userId" value={userId} />
      <NativeSelect name="workspaceId" aria-label="Проект" required>
        {workspaces.map((w) => (
          <NativeSelectOption key={w.id} value={w.id}>
            {w.title}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <RoleSelect />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Дать доступ
      </Button>
    </form>
  );
}

function useRun() {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(ok);
      else toast.error(r.error);
    });
  return { pending, run };
}

/** Роль и отзыв доступа для одной строки «пользователь × проект». */
export function MemberControls({ memberId, role, revoked, label }: { memberId: string; role: WorkspaceRole; revoked: boolean; label: string }) {
  const { pending, run } = useRun();
  if (revoked) return <span className="text-xs text-muted-foreground">доступ отозван</span>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NativeSelect
        aria-label={`Роль: ${label}`}
        value={role}
        disabled={pending}
        onChange={(e) => run(() => changeRole(memberId, e.target.value), "Роль изменена")}
      >
        {WORKSPACE_ROLES.map((r) => (
          <NativeSelectOption key={r} value={r}>
            {ROLE_LABELS[r]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <ConfirmAction
        title="Отозвать доступ?"
        description="Пользователь сразу потеряет доступ к этому проекту."
        confirmLabel="Отозвать"
        onConfirm={() => run(() => revokeAccess(memberId), "Доступ отозван")}
        trigger={
          <Button size="sm" variant="ghost" className="text-destructive" disabled={pending}>
            Отозвать
          </Button>
        }
      />
    </div>
  );
}

export function BlockUserButton({ userId, blocked, name }: { userId: string; blocked: boolean; name: string }) {
  const { pending, run } = useRun();
  if (blocked) {
    return (
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setUserBlocked(userId, false), "Разблокирован")}>
        Разблокировать
      </Button>
    );
  }
  return (
    <ConfirmAction
      title={`Заблокировать ${name}?`}
      description="Все сессии пользователя перестанут действовать сразу. Доступы сохранятся и вернутся после разблокировки."
      confirmLabel="Заблокировать"
      onConfirm={() => run(() => setUserBlocked(userId, true), "Заблокирован")}
      trigger={
        <Button size="sm" variant="ghost" className="text-destructive" disabled={pending}>
          Заблокировать
        </Button>
      }
    />
  );
}
