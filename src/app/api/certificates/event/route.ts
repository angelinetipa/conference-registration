import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  type: z.enum(["PARTICIPATION", "APPEARANCE", "RECOGNITION", "PRESENTATION"]),
  eventId: z.string().optional(),
  recipientName: z.string().min(2),
  role: z.string().optional(),
  paperTitle: z.string().optional(),
  presenterName: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = schema.parse(await req.json());
    if (body.type === "PRESENTATION" && (!body.paperTitle || !body.presenterName)) {
      return NextResponse.json(
        { error: "Presentation certificate requires presenter name and paper title" },
        { status: 400 },
      );
    }
    if (body.type === "RECOGNITION" && !body.role) {
      return NextResponse.json({ error: "Recognition certificate requires role" }, { status: 400 });
    }

    const existing = await prisma.eventCertificateRequest.findFirst({
      where: {
        userId: session.id,
        type: body.type,
        eventId: body.eventId ?? null,
        recipientName: { equals: body.recipientName.trim(), mode: "insensitive" },
        role: body.role
          ? { equals: body.role.trim(), mode: "insensitive" }
          : null,
        paperTitle: body.paperTitle
          ? { equals: body.paperTitle.trim(), mode: "insensitive" }
          : null,
        presenterName: body.presenterName
          ? { equals: body.presenterName.trim(), mode: "insensitive" }
          : null,
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "You already submitted this certificate request." },
        { status: 409 },
      );
    }

    const cert = await prisma.eventCertificateRequest.create({
      data: {
        userId: session.id,
        eventId: body.eventId,
        type: body.type,
        recipientName: body.recipientName.trim(),
        role: body.role?.trim() || null,
        paperTitle: body.paperTitle?.trim() || null,
        presenterName: body.presenterName?.trim() || null,
      },
    });
    return NextResponse.json({ certificate: cert });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
