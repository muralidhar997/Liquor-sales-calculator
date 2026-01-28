import { NextRequest } from "next/server";
import { requireSession, json } from "../_helpers";
import { supabaseAdmin } from "../../../lib/supabase";

export async function GET(req: NextRequest) {
  const gate = await requireSession(req);
  if (!gate.ok) return gate.res;

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("stores")
    .select("id, name")
    .eq("id", gate.session.storeId)
    .maybeSingle();

  if (error || !data) return json({ error: "Store not found" }, 404);

  return json({
    store: { storeId: data.id, storeName: data.name, code4: gate.session.code4 }
  });
}
