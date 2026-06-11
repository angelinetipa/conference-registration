import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { formatApiError, parseProofBase64, parseTransactionDate } from "@/lib/payment";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  eventId: z.string().min(1),
  attendeeName: z.string().min(2),
  attendeeEmail: z.string().email(),
  organization: z.string().optional(),
  paperTitle: z.string().optional(),
  method: z.enum(["BANK", "EWALLET"]),
  transactionDate: z.string().min(1),
  transactionNo: z.string().min(3),
  amount: z.coerce.number().positive(),
  paymentFor: z.string().min(3),
  payeeName: z.string().optional(),
  proofBase64: z.string().min(1),
  proofFileName: z.string().min(1),
  proofMimeType: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = schema.parse(await req.json());
    const event = await prisma.event.findUnique({ where: { id: body.eventId } });
    if (!event?.active) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

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

    const transactionNo = body.transactionNo.trim();
    const duplicateTransaction = await prisma.paymentSubmission.findFirst({
      where: { transactionNo: { equals: transactionNo, mode: "insensitive" } },
      select: { id: true },
    });
    const duplicateMembershipTransaction = await prisma.membershipPayment.findFirst({
      where: { transactionNo: { equals: transactionNo, mode: "insensitive" } },
      select: { id: true },
    });

    if (duplicateTransaction || duplicateMembershipTransaction) {
      return NextResponse.json(
        { error: "This transaction number has already been submitted." },
        { status: 409 },
      );
    }

    const { proofData, proofMimeType, proofFileName } = parseProofBase64(
      body.proofBase64,
      body.proofMimeType,
      body.proofFileName,
    );
    const transactionDate = parseTransactionDate(body.transactionDate);

    const qrCode = `REG-${uuidv4().slice(0, 8).toUpperCase()}`;

    const result = await prisma.$transaction(async (tx) => {
      const reg = await tx.eventRegistration.create({
        data: {
          userId: session.id,
          eventId: body.eventId,
          type: "CONFIRMED",
          status: "PAYMENT_SUBMITTED",
          qrCode,
          attendeeName: body.attendeeName,
          attendeeEmail: normalizedEmail,
          organization: body.organization,
          paperTitle: body.paperTitle,
        },
      });

      const payment = await tx.paymentSubmission.create({
        data: {
          userId: session.id,
          registrationId: reg.id,
          method: body.method,
          status: "PENDING",
          transactionDate,
          transactionNo,
          amount: body.amount,
          paymentFor: body.paymentFor.trim(),
          payeeName: body.payeeName?.trim() || null,
          proofFileName,
          proofMimeType,
          proofData,
        },
      });

      return { reg, payment };
    });

    return NextResponse.json({
      ok: true,
      registration: result.reg,
      payment: { id: result.payment.id, status: result.payment.status },
    });
  } catch (e) {
    return NextResponse.json(
      { error: formatApiError(e, "Payment submission failed") },
      { status: 400 },
    );
  }
}
