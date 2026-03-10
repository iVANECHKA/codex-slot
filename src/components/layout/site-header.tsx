"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/components/providers/session-provider";
import { formatCoins } from "@/lib/utils";

const modeLabels = {
  demo: "демо",
  supabase: "supabase",
} as const;

export function SiteHeader() {
  const { user, loading, logout, mode } = useSession();

  return (
    <header className="sticky top-0 z-30 border-b border-white/8 bg-slate-950/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-3 px-4 py-4 sm:items-center sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3 text-white">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 text-slate-950 shadow-[0_0_32px_rgba(245,158,11,0.45)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-base leading-none tracking-[0.18em] text-amber-100 sm:text-xl sm:tracking-[0.22em]">SKLAD-SLOT</p>
            <p className="truncate text-[10px] uppercase tracking-[0.2em] text-zinc-500 sm:text-xs sm:tracking-[0.32em]">Складской казич</p>
          </div>
        </Link>

        <div className="hidden items-center gap-2 xl:flex">
          <Link href="/lobby" className="rounded-full px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/6 hover:text-white">
            Лобби
          </Link>
          <Link href="/profile" className="rounded-full px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/6 hover:text-white">
            Профиль
          </Link>
        </div>

        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
          <Badge>{modeLabels[mode]} режим</Badge>
          {loading ? (
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-400">Загрузка...</div>
          ) : user ? (
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
              <div className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-right text-sm text-white sm:flex-none sm:px-4">
                <div className="truncate font-semibold leading-tight">{user.displayName}</div>
                <div className="truncate text-[10px] uppercase tracking-[0.12em] text-zinc-400 sm:text-xs sm:tracking-[0.2em]">@{user.login} · {formatCoins(user.balance)} монет</div>
              </div>
              <Button className="shrink-0" variant="secondary" onClick={() => void logout()}>
                Выйти
              </Button>
            </div>
          ) : (
            <Link href="/auth">
              <Button>Войти в казино</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

