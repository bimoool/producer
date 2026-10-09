"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // запасной вариант для старых браузеров / http
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
}

export function CopyButton({ text, label = "Скопировать отчёт", size = "default" }: { text: string; label?: string; size?: "default" | "sm" | "lg" }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size={size}
      variant="secondary"
      onClick={async () => {
        try {
          await copyText(text);
          setCopied(true);
          toast.success("Отчёт скопирован");
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error("Не удалось скопировать — выделите текст вручную");
        }
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {label}
    </Button>
  );
}
