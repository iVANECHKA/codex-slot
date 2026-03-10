import { cn } from "@/lib/utils";
import type { HTMLAttributes, PropsWithChildren } from "react";

export function Panel({ children, className, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

