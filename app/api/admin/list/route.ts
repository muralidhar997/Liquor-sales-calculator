import { NextRequest } from "next/server";
import { requireAdmin, json } from "../../_helpers";
import { supabaseAdmin } from "../../../../lib/supabase";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.res;

  const sb = supabaseAdmin();
  const { data: stores, error: e1 } = await sb.from("stores").select("id,name").order("name");
  if (e1) return json({ error: e1.message }, 500);

  const { data: codes, error: e2 } = await sb
    .from("store_users")
    .select("id, store_id, code4, is_active, stores(name)")
    .order("created_at", { ascending: false });

  if (e2) return json({ error: e2.message }, 500);

  return json({
    stores: stores ?? [],
    codes: (codes ?? []).map((c: any) => ({
      id: c.id,
      store_id: c.store_id,
      code4: c.code4,
      is_active: c.is_active,
      store_name: c.stores?.name ?? ""
    }))
  });
}
