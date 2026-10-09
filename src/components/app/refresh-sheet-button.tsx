"use client";

import { RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { refreshSheet } from "@/app/actions/workspaces";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RefreshSheetButton({ workspaceId }: { workspaceId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await refreshSheet(workspaceId);
          if (r.ok) toast.success("Данные обновлены");
          else toast.error(r.error);
          router.refresh();
        })
      }
    >
      <RefreshCwIcon className={cn(pending && "animate-spin")} />
      {pending ? "Обновляем…" : "Обновить данные"}
    </Button>
  );
}
