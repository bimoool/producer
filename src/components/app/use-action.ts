"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/app/actions";

/** Обёртка над server action формы: показывает тост и вызывает onSuccess. */
export function useFormAction(
  action: (prev: unknown, form: FormData) => Promise<ActionResult>,
  opts: { success?: string; onSuccess?: (r: ActionResult) => void } = {},
) {
  const [state, formAction, pending] = useActionState(action, null);
  const handled = useRef<unknown>(null);
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  });
  useEffect(() => {
    if (!state || handled.current === state) return;
    handled.current = state;
    if (state.ok) {
      if (optsRef.current.success) toast.success(optsRef.current.success);
      optsRef.current.onSuccess?.(state);
    } else toast.error(state.error);
  }, [state]);
  return { formAction, pending };
}
