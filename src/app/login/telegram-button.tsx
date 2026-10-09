"use client";

import { useEffect, useRef } from "react";

/** Официальный Telegram Login Widget в режиме redirect (data-auth-url). */
export function TelegramLoginButton({ botUsername, authUrl }: { botUsername: string; authUrl: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const s = document.createElement("script");
    s.src = "https://telegram.org/js/telegram-widget.js?22";
    s.async = true;
    s.setAttribute("data-telegram-login", botUsername);
    s.setAttribute("data-size", "large");
    s.setAttribute("data-radius", "10");
    s.setAttribute("data-auth-url", authUrl);
    el.replaceChildren(s);
    return () => el.replaceChildren();
  }, [botUsername, authUrl]);
  return <div ref={ref} className="flex min-h-12 justify-center" />;
}
