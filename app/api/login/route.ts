import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "../../../lib/supabase";
import { signSession } from "../../../lib/auth";
import { rateLimit } from "../../../lib/rateLimit";
import { getIP, json } from "../_helpers";

const bodySchema = z.object({ code4: z.string().regex(/^\d{4}$/) });

export async function POST(req: NextRequest) {
  const ip = getIP(req);
  const rl = rateLimit(`login:${ip}`, 20, 10 * 60 * 1000);
  if (!rl.ok) return json({ error: "Too many attempts. Try later." }, 429);

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "Invalid code" }, 400);

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("store_users")
    .select("id, code4, is_active, store_id, stores(name)")
    .eq("code4", body.data.code4)
    .maybeSingle();

  if (error || !data) return json({ error: "Code not found" }, 401);
  if (!data.is_active) return json({ error: "Code disabled" }, 403);

  const token = await signSession({ storeId: data.store_id, code4: data.code4 });

  const res = NextResponse.json({
    ok: true,
    store: { storeId: data.store_id, storeName: (data as any).stores?.name ?? "Store", code4: data.code4 }
  });

  res.cookies.set("session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });

  return res;
}
