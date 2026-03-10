import Link from "next/link";
import { ArrowRight, ShieldCheck, Smartphone, Sparkles, Wallet } from "lucide-react";
import { GameCard } from "@/components/lobby/game-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { getFeaturedGames } from "@/lib/casino/catalog";

const highlights = [
  {
    title: "Казино-математика",
    body: "Слоты на seed-алгоритмах, настраиваемый edge в Crash и серверные поля в Mines.",
    icon: ShieldCheck,
  },
  {
    title: "Профиль на одном экране",
    body: "Имя, логин и виртуальный баланс всегда доступны в верхней панели сайта.",
    icon: Wallet,
  },
  {
    title: "Mobile-first интерфейс",
    body: "Верстка под вертикальный экран, удобные зоны нажатия и единый shell для новых игр.",
    icon: Smartphone,
  },
];

export default function Home() {
  const games = getFeaturedGames();

  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel className="overflow-hidden p-0">
          <div className="relative p-6 sm:p-8 lg:p-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.2),transparent_30%),radial-gradient(circle_at_70%_30%,rgba(244,63,94,0.16),transparent_20%)]" />
            <div className="relative space-y-6">
              <Badge>Премиум симулятор</Badge>
              <div className="max-w-3xl space-y-4">
                <h1 className="font-display text-5xl leading-none sm:text-6xl lg:text-7xl">
                  Онлайн-казино симулятор с красивым мобильным интерфейсом.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
                  Aurelia объединяет дорогой casino-стиль, модульные игровые движки, простую регистрацию по логину и паролю и backend, готовый к работе с Supabase.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/auth">
                  <Button className="gap-2 px-6 py-3 text-base">
                    Начать сейчас
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/lobby">
                  <Button variant="secondary" className="px-6 py-3 text-base">
                    Открыть лобби
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </Panel>

        <div className="grid gap-6">
          <Panel className="space-y-4">
            <div className="flex items-center gap-3 text-amber-200">
              <Sparkles className="h-5 w-5" />
              <span className="text-xs uppercase tracking-[0.35em]">Состав релиза</span>
            </div>
            <h2 className="font-display text-3xl">3 слота, Crash, Mines, профиль и кошелек.</h2>
            <p className="text-sm leading-6 text-zinc-400">
              Каждая игра работает на типизированных контрактах, поэтому новые тайтлы, конфиги и медиа можно добавлять без перестройки платформы.
            </p>
          </Panel>
          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <Panel key={item.title} className="space-y-3">
                  <Icon className="h-5 w-5 text-amber-200" />
                  <h3 className="font-semibold text-white">{item.title}</h3>
                  <p className="text-sm leading-6 text-zinc-400">{item.body}</p>
                </Panel>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Превью лобби</p>
            <h2 className="mt-2 font-display text-4xl">Модульный каталог игр</h2>
          </div>
          <Link href="/lobby" className="text-sm font-semibold text-amber-200">
            Смотреть все игры
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {games.slice(0, 3).map((game, index) => (
            <GameCard key={game.slug} game={game} index={index} />
          ))}
        </div>
      </section>
    </div>
  );
}