import { getCasinoMode, getCurrentUser } from "@/lib/casino/repository";
import { ok } from "@/lib/api";

export async function GET() {
  const user = await getCurrentUser();
  return ok({ user, mode: getCasinoMode() });
}

