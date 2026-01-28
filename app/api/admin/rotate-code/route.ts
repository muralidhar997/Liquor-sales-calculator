import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin, json } from "../../_helpers";
import { supabaseAdmin } from "../../../../lib/supabase";

const schema = z.object({ storeId: z.string().uuid() });

function randomCode4() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;

  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "Invalid" }, 400);

  const sb = supabaseAdmin();

  // Disable existing active codes for that store
  await sb.from("store_users").update({ is_active: false }).eq("store_id", body.data.storeId);

  // Try a few times to avoid collisions
  for (let i=0;i<10;i++) {
    const code4 = randomCode4();
    const { error } = await sb.from("store_users").insert({
      store_id: body.data.storeId,
      code4,
      is_active: true
    });
    if (!error) return json({ ok: true, code4 });
  }

  return json({ error: "Failed to generate unique code" }, 500);
}
