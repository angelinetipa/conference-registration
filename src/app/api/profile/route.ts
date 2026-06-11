import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().min(2),
  organization: z.string().max(150).optional(),
  phone: z.string().max(13).regex(/^(09|\+639|639)\d{9}$/, "Invalid phone number format").optional(),
  country: z.string().min(2).max(2),
});

export async function GET() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      email: true,
      name: true,
      organization: true,
      phone: true,
      country: true,
      createdAt: true,
    },
  });

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ user });
}

export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    const body = updateSchema.parse(await req.json());

    const user = await prisma.user.update({
      where: { id: session.id },
      data: {
        name: body.name.trim(),
        organization: body.organization?.trim() || null,
        phone: body.phone?.trim() || null,
        country: body.country,
      },
    });

    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Profile update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
