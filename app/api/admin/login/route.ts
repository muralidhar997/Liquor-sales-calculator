import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "../../../../lib/env";
import { signSession } from "../../../../lib/auth";
import { json } from "../../_helpers";

const schema = z.object({ password: z.string().min(1) });

export async function POST(req: NextRequest) {
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "Invalid" }, 400);

  if (body.data.password !== env.ADMIN_PASSWORD) return json({ error: "Unauthorized" }, 401);

  const token = await signSession({ storeId: "admin", code4: "0000", isAdmin: true });
  const res = NextResponse.json({ ok: true });
  res.cookies.set("session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
  return res;
}
