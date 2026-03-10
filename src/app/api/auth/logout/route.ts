import { fail, ok } from "@/lib/api";
import { logout } from "@/lib/casino/repository";

export async function POST() {
  try {
    await logout();
    return ok({ success: true });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Не удалось выйти", 400);
  }
}

