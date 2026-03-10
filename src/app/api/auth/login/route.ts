import { fail, ok } from "@/lib/api";
import { loginWithLogin } from "@/lib/casino/repository";
import { authPayloadSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const payload = authPayloadSchema.parse(await request.json());
    const user = await loginWithLogin(payload);
    return ok({ user });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Не удалось войти", 400);
  }
}

