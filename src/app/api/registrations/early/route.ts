import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildQrPayload, buildVerifyUrl, generateQrDataUrl } from "@/lib/qr";

const schema = z.object({
  eventId: z.string(),
  attendeeName: z.string().min(2),
  attendeeEmail: z.string().email(),
  organization: z.string().max(150).optional(),
  paperTitle: z.string().max(255).optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = schema.parse(await req.json());
    const event = await prisma.event.findUnique({ where: { id: body.eventId } });
    if (!event?.active) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const normalizedEmail = body.attendeeEmail.trim().toLowerCase();
    const existing = await prisma.eventRegistration.findFirst({
      where: {
        eventId: body.eventId,
        OR: [
          { userId: session.id },
          { attendeeEmail: { equals: normalizedEmail, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "You are already registered for this event." },
        { status: 409 },
      );
    }

    const qrCode = `REG-${uuidv4().slice(0, 8).toUpperCase()}`;
    const reg = await prisma.eventRegistration.create({
      data: {
        userId: session.id,
        eventId: body.eventId,
        type: "EARLY",
        status: "APPROVED",
        qrCode,
        attendeeName: body.attendeeName,
        attendeeEmail: normalizedEmail,
        organization: body.organization,
        paperTitle: body.paperTitle,
      },
    });

    const payload = buildQrPayload(reg.id, reg.qrCode);
    const qrDataUrl = await generateQrDataUrl(payload);

    return NextResponse.json({
      registration: reg,
      qrDataUrl,
      verifyUrl: buildVerifyUrl(reg.qrCode),
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Please fill in all required fields correctly." }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Registration failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
