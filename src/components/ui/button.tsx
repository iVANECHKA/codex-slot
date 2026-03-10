import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: PropsWithChildren<ButtonProps>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 text-slate-950 shadow-[0_0_30px_rgba(251,191,36,0.35)] hover:scale-[1.01]",
        variant === "secondary" &&
          "border border-white/15 bg-white/8 text-white hover:bg-white/12",
        variant === "ghost" && "text-zinc-300 hover:bg-white/5 hover:text-white",
        variant === "danger" && "bg-rose-500/20 text-rose-200 hover:bg-rose-500/30",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

