import { cn } from "@/lib/utils";
import type { PropsWithChildren } from "react";

export function Badge({ children, className }: PropsWithChildren<{ className?: string }>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-zinc-300",
        className,
      )}
    >
      {children}
    </span>
  );
}

