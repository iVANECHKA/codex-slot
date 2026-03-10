"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { GameDefinition } from "@/lib/casino/types";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { gameKindLabels } from "@/lib/casino/catalog";

export function GameCard({ game, index }: { game: GameDefinition; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
    >
      <Link href={`/games/${game.slug}`}>
        <Panel className="group h-full overflow-hidden p-0 transition hover:-translate-y-1 hover:border-white/20">
          <div className={`min-h-44 bg-gradient-to-br ${game.accent} p-5 text-slate-950`}>
            <div className="flex items-start justify-between gap-4">
              <Badge className="border-slate-950/10 bg-slate-950/10 text-slate-900">{game.eyebrow}</Badge>
              <span className="rounded-full bg-slate-950/10 px-3 py-1 text-xs uppercase tracking-[0.3em]">{gameKindLabels[game.kind]}</span>
            </div>
            <div className="mt-10 max-w-xs">
              <h3 className="font-display text-3xl leading-none">{game.title}</h3>
              <p className="mt-3 text-sm/6 text-slate-900/80">{game.thumbnail}</p>
            </div>
          </div>
          <div className="space-y-3 p-5">
            <p className="text-sm uppercase tracking-[0.25em] text-zinc-500">{game.subtitle}</p>
            <p className="text-sm leading-6 text-zinc-300">{game.description}</p>
            <span className="inline-flex items-center text-sm font-semibold text-amber-200 transition group-hover:translate-x-1">
              Открыть игру
            </span>
          </div>
        </Panel>
      </Link>
    </motion.div>
  );
}