import { NextResponse } from "next/server";
import { seedDatabase } from "@/lib/seed-db";
import { prisma } from "@/lib/prisma";

/** Bootstrap demo data. Empty DB seeds without a key; otherwise requires AUTH_SECRET as ?key= */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") ?? "";
  const setupSecret = process.env.SETUP_SECRET ?? process.env.AUTH_SECRET;
  const userCount = await prisma.user.count();

  if (userCount > 0) {
    if (!setupSecret || key !== setupSecret) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    await seedDatabase();
    return NextResponse.json({
      ok: true,
      message: "Demo users created. Sign in with admin@conference.local / admin12345",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Seed failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
