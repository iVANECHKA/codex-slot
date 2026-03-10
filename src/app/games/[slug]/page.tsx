import { notFound } from "next/navigation";
import { CrashStudio } from "@/components/games/crash-studio";
import { MinesStudio } from "@/components/games/mines-studio";
import { SlotStudio } from "@/components/games/slot-studio";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { getGameBySlug } from "@/lib/casino/catalog";

export default async function GamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = getGameBySlug(slug);

  if (!game) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Panel className={`relative isolate overflow-hidden bg-gradient-to-br ${game.accent} p-0 text-white`}>
        <div className="pointer-events-none absolute inset-0 bg-black/45" />
        <div className="relative z-10 space-y-4 p-6 sm:p-8">
          <Badge className="border-white/25 bg-black/35 text-white">{game.eyebrow}</Badge>
          <div>
            <h1 className="font-display text-5xl sm:text-6xl">{game.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-100 sm:text-base">{game.hero}</p>
          </div>
        </div>
      </Panel>

      {game.kind === "slot" ? <SlotStudio game={game} /> : null}
      {game.kind === "crash" ? <CrashStudio game={game} /> : null}
      {game.kind === "mines" ? <MinesStudio game={game} /> : null}
    </div>
  );
}