import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "../../lib/auth";

export function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export function getIP(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";
}

export async function getSession(req: NextRequest) {
  const token = req.cookies.get("session")?.value;
  if (!token) return null;
  return await verifySession(token);
}

export async function requireSession(req: NextRequest) {
  const s = await getSession(req);
  if (!s) return { ok: false as const, res: json({ error: "Not signed in" }, 401) };
  return { ok: true as const, session: s };
}

export async function requireAdmin(req: NextRequest) {
  const s = await getSession(req);
  if (!s?.isAdmin) return { ok: false as const, res: json({ error: "Admin only" }, 401) };
  return { ok: true as const, session: s };
}
