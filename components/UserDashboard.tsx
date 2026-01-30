"use client";

import { useState } from "react";
import PdfUpload from "./PdfUpload";
import { Card } from "./ui";
import type { ParsedAudit, ParsedRow } from "../lib/parseDailySheet";

/* ---------------- helpers ---------------- */

function keyOfRow(r: ParsedRow) {
  return `${(r.brandName ?? "").toLowerCase()}__${r.sizeMl ?? 0}`;
}

/**
 * Merge ONLY salesQty column from new rows
 */
function mergeSalesQtyOnly(existing: ParsedRow[], incoming: ParsedRow[]): ParsedRow[] {
  const map = new Map(incoming.map((r) => [keyOfRow(r), r]));

  return existing.map((row) => {
    const newer = map.get(keyOfRow(row));
    if (!newer) return row;

    return {
      ...row,
      // ✅ update ONLY Sales Quantity
      salesQty: newer.salesQty ?? row.salesQty,
    };
  });
}

/* ---------------- component ---------------- */

export default function UserDashboard() {
  const [summary, setSummary] = useState<ParsedAudit | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);

  function handleParsed(parsed: ParsedAudit) {
    // ✅ Always update summary when a PDF is uploaded
    setSummary(parsed);

    // ✅ First upload → load full rows
    if (rows.length === 0) {
      setRows(parsed.rows ?? []);
      return;
    }

    // ✅ Next uploads → update only salesQty
    setRows((prev) => mergeSalesQtyOnly(prev, parsed.rows ?? []));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* LEFT SIDE */}
      <div className="space-y-4">
        {/* SUMMARY */}
        <Card title="Summary">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <SummaryItem label="Opening Balance" value={summary?.openingBalance} />
            <SummaryItem label="Total Sales" value={summary?.totalSales} />
            <SummaryItem label="Office Cash (Night)" value={summary?.officeCashNight} />
            <SummaryItem label="Office Cash (Sheet)" value={summary?.officeCashSheet} />
            <SummaryItem label="Expenditure" value={summary?.expenditure} />
            <SummaryItem label="Balance" value={summary?.balance} />
          </div>

          <div className="mt-3 text-xs text-zinc-600">
            Audit Date: <span className="font-semibold">{summary?.auditDate ?? "—"}</span>
          </div>
        </Card>

        {/* PDF UPLOAD */}
        <PdfUpload
          onParsed={(p) => {
            handleParsed(p);
          }}
        />
      </div>

      {/* RIGHT SIDE */}
      <div>
        <Card title="Balance Sheet View">
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-zinc-100">
                <tr>
                  <th className="border px-2 py-1 text-left">Brand</th>
                  <th className="border px-2 py-1 text-right">OB</th>
                  <th className="border px-2 py-1 text-right">Rec</th>
                  <th className="border px-2 py-1 text-right">Total</th>
                  <th className="border px-2 py-1 text-right">Others</th>
                  <th className="border px-2 py-1 text-right">CB</th>
                  <th className="border px-2 py-1 text-right">Sales</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => (
                  <tr key={keyOfRow(r)}>
                    <td className="border px-2 py-1">{r.brandName}</td>
                    <td className="border px-2 py-1 text-right">{r.opening}</td>
                    <td className="border px-2 py-1 text-right">{r.received}</td>
                    <td className="border px-2 py-1 text-right">{r.total}</td>
                    <td className="border px-2 py-1 text-right">{r.others}</td>
                    <td className="border px-2 py-1 text-right">{r.closing}</td>
                    <td className="border px-2 py-1 text-right font-semibold">{r.salesQty}</td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-zinc-500">
                      Select date → upload PDF to populate
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- small UI ---------------- */

function SummaryItem({ label, value }: { label: string; value?: number }) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="font-semibold">{value ?? "—"}</div>
    </div>
  );
}


