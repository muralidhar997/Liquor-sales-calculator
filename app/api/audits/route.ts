import { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession, json } from "../_helpers";
import { supabaseAdmin } from "../../../lib/supabase";

const lineItemSchema = z.object({
  brandName: z.string().min(1),
  sizeMl: z.number().optional().nullable(),
  opening: z.number().optional().nullable(),
  received: z.number().optional().nullable(),
  total: z.number().optional().nullable(),
  others: z.number().optional().nullable(),
  closing: z.number().optional().nullable(),
  salesQty: z.number().optional().nullable(),
  rate: z.number().optional().nullable(),
  salesAmount: z.number().optional().nullable()
});

const bodySchema = z.object({
  auditDate: z.string().nullable().optional(),
  openingBalance: z.number(),
  totalSales: z.number(),
  officeCashNight: z.number(),
  officeCashSheet: z.number(),
  expenditure: z.number(),
  balance: z.number(),
  lineItems: z.array(lineItemSchema).default([])
});

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const gate = await requireSession(req);
  if (!gate.ok) return gate.res;

  const sb = supabaseAdmin();
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const month = url.searchParams.get("month");

  // GET /api/audits?date=YYYY-MM-DD  -> return that day's audit + line items
  if (date) {
    const { data: audit, error } = await sb
      .from("daily_audits")
      .select("id,audit_date,opening_balance,total_sales,office_cash_night,office_cash_sheet,expenditure,balance")
      .eq("store_id", gate.session.storeId)
      .eq("audit_date", date)
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);
    if (!audit) return json({ ok: true, audit: null }, 200);

    const { data: items, error: e2 } = await sb
      .from("audit_line_items")
      .select("brand_name,size_ml,ob,received,total,others,cb,sales_qty,rate,sales_amount")
      .eq("audit_id", audit.id)
      .order("brand_name", { ascending: true });

    if (e2) return json({ error: e2.message }, 500);

    return json({
      ok: true,
      audit: {
        auditDate: audit.audit_date,
        openingBalance: Number(audit.opening_balance ?? 0),
        totalSales: Number(audit.total_sales ?? 0),
        officeCashNight: Number(audit.office_cash_night ?? 0),
        officeCashSheet: Number(audit.office_cash_sheet ?? 0),
        expenditure: Number(audit.expenditure ?? 0),
        balance: Number(audit.balance ?? 0),
        lineItems: (items ?? []).map(r => ({
          brandName: r.brand_name,
          sizeMl: r.size_ml,
          opening: r.ob,
          received: r.received,
          total: r.total,
          others: r.others,
          closing: r.cb,
          salesQty: r.sales_qty,
          rate: r.rate,
          salesAmount: r.sales_amount
        }))
      }
    });
  }

  // GET /api/audits?month=YYYY-MM -> return list of audits for that month (for export / history)
  if (month) {
    const start = `${month}-01`;
    const endDate = new Date(`${month}-01T00:00:00Z`);
    endDate.setUTCMonth(endDate.getUTCMonth() + 1);
    const end = toIsoDate(endDate);

    const { data, error } = await sb
      .from("daily_audits")
      .select("audit_date,opening_balance,total_sales,office_cash_night,office_cash_sheet,expenditure,balance")
      .eq("store_id", gate.session.storeId)
      .gte("audit_date", start)
      .lt("audit_date", end)
      .order("audit_date", { ascending: true });

    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, rows: data ?? [] });
  }

  return json({ error: "Provide ?date=YYYY-MM-DD or ?month=YYYY-MM" }, 400);
}

export async function POST(req: NextRequest) {
  const gate = await requireSession(req);
  if (!gate.ok) return gate.res;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid payload", issues: parsed.error.issues }, 400);

  const sb = supabaseAdmin();
  const auditDate = parsed.data.auditDate ? new Date(parsed.data.auditDate) : new Date();
  const isoDate = toIsoDate(auditDate);

  // Lock: only one upload/save per store per day.
  const { data: existing, error: exErr } = await sb
    .from("daily_audits")
    .select("id")
    .eq("store_id", gate.session.storeId)
    .eq("audit_date", isoDate)
    .maybeSingle();
  if (exErr) return json({ error: exErr.message }, 500);
  if (existing) return json({ error: "Already uploaded/saved for this date. Contact admin to change." }, 409);

  // Insert (unique constraint prevents duplicates)
  const { data: audit, error } = await sb
    .from("daily_audits")
    .insert({
      store_id: gate.session.storeId,
      audit_date: isoDate,
      opening_balance: parsed.data.openingBalance,
      total_sales: parsed.data.totalSales,
      office_cash_night: parsed.data.officeCashNight,
      office_cash_sheet: parsed.data.officeCashSheet,
      expenditure: parsed.data.expenditure,
      balance: parsed.data.balance
    })
    .select("id")
    .single();

  if (error || !audit) return json({ error: error?.message ?? "Failed to save audit" }, 500);

  // Replace line items for that audit
  await sb.from("audit_line_items").delete().eq("audit_id", audit.id);
  if (parsed.data.lineItems.length) {
    const rows = parsed.data.lineItems.map(li => ({
      audit_id: audit.id,
      brand_name: li.brandName,
      size_ml: li.sizeMl ?? null,
      ob: li.opening ?? null,
      received: li.received ?? null,
      total: li.total ?? null,
      others: li.others ?? null,
      cb: li.closing ?? null,
      sales_qty: li.salesQty ?? null,
      rate: li.rate ?? null,
      sales_amount: li.salesAmount ?? null
    }));
    const { error: e2 } = await sb.from("audit_line_items").insert(rows);
    if (e2) return json({ error: e2.message }, 500);
  }

  return json({ ok: true, auditId: audit.id });
}
