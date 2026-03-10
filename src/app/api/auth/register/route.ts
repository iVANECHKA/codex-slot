import { fail, ok } from "@/lib/api";
import { registerWithLogin } from "@/lib/casino/repository";
import { registerPayloadSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  try {
    const payload = registerPayloadSchema.parse(await request.json());
    const user = await registerWithLogin(payload);
    return ok({ user });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Не удалось зарегистрироваться", 400);
  }
}

