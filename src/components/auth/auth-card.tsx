"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { useSession } from "@/components/providers/session-provider";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

interface AuthResponse {
  error?: string;
}

const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";

export function AuthCard() {
  const router = useRouter();
  const { refresh } = useSession();
  const [mode, setMode] = useState<"login" | "register">("register");
  const [displayName, setDisplayName] = useState("Игрок");
  const [login, setLogin] = useState("player1");
  const [password, setPassword] = useState("1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError("");

    if (isStaticExport) {
      setLoading(false);
      setError("Backend API is unavailable on GitHub Pages.");
      return;
    }

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        mode === "login"
          ? { login, password }
          : { login, password, displayName },
      ),
    });

    const payload = (await response.json()) as AuthResponse;
    if (!response.ok) {
      setLoading(false);
      setError(payload.error ?? "Не удалось выполнить запрос");
      return;
    }

    await refresh();
    router.push("/lobby");
    router.refresh();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="mx-auto max-w-md"
    >
      <Panel className="space-y-6 border-amber-300/10 p-6 sm:p-8">
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-amber-200/80">Быстрый вход</p>
          <h1 className="font-display text-4xl text-white">Вход на площадку</h1>
          <p className="text-sm text-zinc-400">
            Только логин и пароль. Без почты, капчи и лишних шагов.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-full border border-white/10 bg-black/20 p-1">
          <button
            className={`rounded-full px-4 py-3 text-sm transition ${mode === "register" ? "bg-white text-slate-950" : "text-zinc-400"}`}
            onClick={() => setMode("register")}
            type="button"
          >
            Регистрация
          </button>
          <button
            className={`rounded-full px-4 py-3 text-sm transition ${mode === "login" ? "bg-white text-slate-950" : "text-zinc-400"}`}
            onClick={() => setMode("login")}
            type="button"
          >
            Вход
          </button>
        </div>

        <div className="space-y-3">
          {mode === "register" ? (
            <label className="block space-y-2 text-sm text-zinc-300">
              <span>Имя</span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-amber-300/50"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </label>
          ) : null}
          <label className="block space-y-2 text-sm text-zinc-300">
            <span>Логин</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-amber-300/50"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
            />
          </label>
          <label className="block space-y-2 text-sm text-zinc-300">
            <span>Пароль</span>
            <input
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:border-amber-300/50"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
        </div>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}

        <Button className="w-full py-3 text-base" disabled={loading} onClick={() => void submit()}>
          {loading ? "Обработка..." : mode === "register" ? "Создать аккаунт" : "Открыть аккаунт"}
        </Button>
      </Panel>
    </motion.div>
  );
}