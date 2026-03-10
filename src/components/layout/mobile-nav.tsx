"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gamepad2, LayoutGrid, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Главная", icon: Gamepad2 },
  { href: "/lobby", label: "Лобби", icon: LayoutGrid },
  { href: "/profile", label: "Профиль", icon: UserRound },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-4 bottom-4 z-40 rounded-full border border-white/10 bg-slate-950/85 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur xl:hidden">
      <ul className="grid grid-cols-3 gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-full px-3 py-3 text-sm transition",
                  active
                    ? "bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 text-slate-950"
                    : "text-zinc-300 hover:bg-white/8 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}