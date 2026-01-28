import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin, json } from "../../_helpers";
import { supabaseAdmin } from "../../../../lib/supabase";

const schema = z.object({ codeId: z.string().uuid(), is_active: z.boolean() });

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;

  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "Invalid" }, 400);

  const sb = supabaseAdmin();
  const { error } = await sb.from("store_users").update({ is_active: body.data.is_active }).eq("id", body.data.codeId);
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
}
