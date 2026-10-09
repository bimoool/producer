import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { appOrigin } from "@/lib/app-origin";
import { getBotUsername } from "@/lib/bot-username";
import { authConfig } from "@/lib/telegram-auth";
import { TelegramLoginButton } from "./telegram-button";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  forbidden: "Этому Telegram-аккаунту доступ закрыт.",
  bad_signature: "Не удалось подтвердить вход. Попробуйте ещё раз.",
  bad_request: "Не удалось подтвердить вход. Попробуйте ещё раз.",
  expired: "Ссылка входа устарела. Нажмите кнопку ещё раз.",
  replay: "Эта ссылка входа уже использована. Нажмите кнопку ещё раз.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? ERRORS[sp.error] : undefined;
  const cfg = authConfig();
  const bot = cfg ? await getBotUsername(cfg.botToken) : null;
  const origin = appOrigin();

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Goal Tracker</CardTitle>
          <CardDescription>Вход через Telegram</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-center text-sm">
          {error ? <p className="text-destructive">{error}</p> : null}
          {!cfg ? (
            <p className="text-muted-foreground">Вход не настроен на сервере. Доступ закрыт.</p>
          ) : !bot ? (
            <p className="text-muted-foreground">Не удалось связаться с Telegram. Обновите страницу через минуту.</p>
          ) : (
            <TelegramLoginButton botUsername={bot} authUrl={`${origin}/auth/telegram/callback`} />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
