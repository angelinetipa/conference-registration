import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { formatApiError, parseProofBase64, parseTransactionDate } from "@/lib/payment";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  membershipId: z.string().min(1),
  method: z.enum(["BANK", "EWALLET"]),
  transactionDate: z.string().min(1),
  transactionNo: z.string().min(3),
  amount: z.coerce.number().positive(),
  paymentFor: z.string().min(3),
  payeeName: z.string().optional(),
  proofBase64: z.string().min(1),
  proofFileName: z.string().min(1),
  proofMimeType: z.string().min(1),
  isRenewal: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = schema.parse(await req.json());
    const membership = await prisma.membership.findFirst({
      where: { id: body.membershipId, userId: session.id },
    });
    if (!membership) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    const { proofData, proofMimeType, proofFileName } = parseProofBase64(
      body.proofBase64,
      body.proofMimeType,
      body.proofFileName,
    );
    const transactionDate = parseTransactionDate(body.transactionDate);
    const transactionNo = body.transactionNo.trim();

    const duplicateMembershipTransaction = await prisma.membershipPayment.findFirst({
      where: {
        transactionNo: { equals: transactionNo, mode: "insensitive" },
        NOT: { membershipId: membership.id, status: "PENDING" },
      },
      select: { id: true },
    });
    const duplicateEventTransaction = await prisma.paymentSubmission.findFirst({
      where: { transactionNo: { equals: transactionNo, mode: "insensitive" } },
      select: { id: true },
    });

    if (duplicateMembershipTransaction || duplicateEventTransaction) {
      return NextResponse.json(
        { error: "This transaction number has already been submitted." },
        { status: 409 },
      );
    }

    const paymentData = {
      method: body.method,
      status: "PENDING" as const,
      transactionDate,
      transactionNo,
      amount: body.amount,
      paymentFor: body.paymentFor.trim(),
      payeeName: body.payeeName?.trim() || null,
      proofFileName,
      proofMimeType,
      proofData,
      isRenewal: body.isRenewal ?? false,
      reviewedAt: null,
      adminNotes: null,
    };

    const existingPending = await prisma.membershipPayment.findFirst({
      where: { membershipId: membership.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });

    const payment = existingPending
      ? await prisma.membershipPayment.update({
          where: { id: existingPending.id },
          data: paymentData,
        })
      : await prisma.membershipPayment.create({
          data: {
            userId: session.id,
            membershipId: membership.id,
            ...paymentData,
          },
        });

    if (membership.status !== "ACTIVE") {
      await prisma.membership.update({
        where: { id: membership.id },
        data: { status: "PENDING_PAYMENT" },
      });
    }

    return NextResponse.json({ payment: { id: payment.id, status: payment.status } });
  } catch (e) {
    return NextResponse.json(
      { error: formatApiError(e, "Payment failed") },
      { status: 400 },
    );
  }
}
