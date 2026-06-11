import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, registerUser } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  organization: z.string().max(150).optional(),
  phone: z.string().max(13).regex(/^(09|\+639|639)\d{9}$/, "Invalid phone number format").optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const user = await registerUser(body);
    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Registration failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
