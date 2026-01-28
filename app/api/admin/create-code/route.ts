import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin, json } from "../../_helpers";
import { supabaseAdmin } from "../../../../lib/supabase";

const schema = z.object({
  storeId: z.string().uuid(),
  code4: z.string().regex(/^\d{4}$/)
});

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;

  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "Invalid payload" }, 400);

  const sb = supabaseAdmin();
  const { error } = await sb.from("store_users").insert({
    store_id: body.data.storeId,
    code4: body.data.code4,
    is_active: true
  });
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
}
