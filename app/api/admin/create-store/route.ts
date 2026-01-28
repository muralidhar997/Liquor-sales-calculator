import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin, json } from "../../_helpers";
import { supabaseAdmin } from "../../../../lib/supabase";

const schema = z.object({ name: z.string().min(2) });

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;

  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "Invalid store name" }, 400);

  const sb = supabaseAdmin();
  const { error } = await sb.from("stores").insert({ name: body.data.name });
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true });
}
