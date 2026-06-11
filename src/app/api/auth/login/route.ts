import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, loginUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { seedDatabase } from "@/lib/seed-db";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    if ((await prisma.user.count()) === 0) {
      await seedDatabase();
    }
    const user = await loginUser(body.email, body.password);
    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Login failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
