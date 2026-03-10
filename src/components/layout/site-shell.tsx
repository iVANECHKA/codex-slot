import type { PropsWithChildren } from "react";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SiteHeader } from "@/components/layout/site-header";

export function SiteShell({ children }: PropsWithChildren) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.16),transparent_28%),linear-gradient(180deg,#09090b,#111827_48%,#050816)] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent,rgba(255,255,255,0.02)_40%,transparent),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:100%_100%,24px_24px] opacity-35" />
      <SiteHeader />
      <main className="relative mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 lg:px-8">{children}</main>
      <MobileNav />
    </div>
  );
}

