"use client";

import Link from "next/link";
import { useSession } from "@/components/providers/session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { gameCatalog, gameKindLabels } from "@/lib/casino/catalog";
import { formatCoins } from "@/lib/utils";

const modeLabels = {
  demo: "демо",
  supabase: "supabase",
} as const;

export default function ProfilePage() {
  const { user, mode } = useSession();

  if (!user) {
    return (
      <Panel className="mx-auto max-w-2xl space-y-4 text-center">
        <Badge>Гость</Badge>
        <h1 className="font-display text-5xl">Профиль закрыт</h1>
        <p className="text-sm leading-7 text-zinc-400">Создай аккаунт по логину и паролю, чтобы сохранять виртуальный баланс, имя профиля и доступ к играм.</p>
        <div>
          <Link href="/auth">
            <Button>Открыть вход</Button>
          </Link>
        </div>
      </Panel>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Panel className="space-y-4">
        <Badge>{modeLabels[mode]} режим</Badge>
        <h1 className="font-display text-5xl">{user.displayName}</h1>
        <div className="space-y-2 text-sm text-zinc-400">
          <p>Логин: @{user.login}</p>
          <p>Баланс: {formatCoins(user.balance)} монет</p>
          <p>Валюта: только виртуальные монеты</p>
        </div>
      </Panel>

      <Panel className="space-y-4">
        <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Доступные игры</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {gameCatalog.map((game) => (
            <Link
              key={game.slug}
              href={`/games/${game.slug}`}
              className="rounded-[24px] border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/8"
            >
              <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">{gameKindLabels[game.kind]}</p>
              <h2 className="mt-2 font-display text-2xl">{game.title}</h2>
              <p className="mt-2 text-sm text-zinc-400">{game.subtitle}</p>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}