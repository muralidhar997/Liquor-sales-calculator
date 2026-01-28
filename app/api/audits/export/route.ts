import { NextRequest } from "next/server";
import { requireSession, json } from "../../_helpers";
import { supabaseAdmin } from "../../../../lib/supabase";

function csvEscape(v: unknown) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export async function GET(req: NextRequest) {
  const gate = await requireSession(req);
  if (!gate.ok) return gate.res;

  const url = new URL(req.url);
  const month = url.searchParams.get("month");
  if (!month) return json({ error: "Provide ?month=YYYY-MM" }, 400);

  const sb = supabaseAdmin();
  const start = `${month}-01`;
  const endDate = new Date(`${month}-01T00:00:00Z`);
  endDate.setUTCMonth(endDate.getUTCMonth() + 1);
  const end = endDate.toISOString().slice(0, 10);

  const { data, error } = await sb
    .from("daily_audits")
    .select("audit_date,opening_balance,total_sales,office_cash_night,office_cash_sheet,expenditure,balance")
    .eq("store_id", gate.session.storeId)
    .gte("audit_date", start)
    .lt("audit_date", end)
    .order("audit_date", { ascending: true });

  if (error) return json({ error: error.message }, 500);

  const header = [
    "audit_date",
    "opening_balance",
    "total_sales",
    "office_cash_night",
    "office_cash_sheet",
    "expenditure",
    "balance"
  ];

  const lines = [header.join(",")];
  for (const r of data ?? []) {
    lines.push(
      [
        r.audit_date,
        r.opening_balance,
        r.total_sales,
        r.office_cash_night,
        r.office_cash_sheet,
        r.expenditure,
        r.balance
      ]
        .map(csvEscape)
        .join(",")
    );
  }

  const csv = lines.join("\n");
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="audit-${month}.csv"`
    }
  });
}
