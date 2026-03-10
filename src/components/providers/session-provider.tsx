"use client";

import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { SessionUser } from "@/lib/casino/types";
import { getStaticSessionUser, staticLogout } from "@/lib/static-export-demo";

interface SessionContextValue {
  user: SessionUser | null;
  loading: boolean;
  mode: "demo" | "supabase";
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);
const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";

async function loadSession() {
  if (isStaticExport) {
    return { user: getStaticSessionUser(), mode: "demo" as const };
  }

  try {
    const response = await fetch("/api/me", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Session request failed");
    }

    return (await response.json()) as {
      user: SessionUser | null;
      mode: "demo" | "supabase";
    };
  } catch {
    return { user: null, mode: "demo" as const };
  }
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"demo" | "supabase">("demo");

  const refresh = useCallback(async () => {
    setLoading(true);
    const payload = await loadSession();
    setUser(payload.user ?? null);
    setMode(payload.mode ?? "demo");
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    if (isStaticExport) {
      staticLogout();
    } else {
      await fetch("/api/auth/logout", { method: "POST" });
    }
    await refresh();
  }, [refresh]);

  useEffect(() => {
    let active = true;

    void loadSession().then((payload) => {
      if (!active) {
        return;
      }
      setUser(payload.user ?? null);
      setMode(payload.mode ?? "demo");
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({ user, loading, mode, refresh, logout }),
    [loading, logout, mode, refresh, user],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return context;
}

