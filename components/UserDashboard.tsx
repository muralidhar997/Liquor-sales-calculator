"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import PdfUpload from "./PdfUpload";
import { Card } from "./ui";
import type { ParsedAudit, ParsedRow } from "../lib/parseDailySheet";

/* ---------------- helpers ---------------- */

function keyOfRow(r: ParsedRow) {
  return `${(r.brandName ?? "").toLowerCase()}__${r.sizeMl ?? ""}`;
}

/**
 * Merge ONLY sold (sales) column from new rows
 */
function mergeSalesOnly(existing: ParsedRow[], incoming: ParsedRow[]): ParsedRow[] {
  const map = new Map(incoming.map((r) => [keyOfRow(r), r]));

  return existing.map((row) => {
    const newer = map.get(keyOfRow(row));
    if (!newer) return row;

    return {
      ...row,
      sold: newer.sold ?? row.sold,
    };
  });
}

/* ---------------- component ---------------- */

export default function UserDashboard() {
  const searchParams = useSearchParams();

  // ✅ storeId from URL: /user?storeId=abc
  const storeId = useMemo(() => {
    return searchParams.get("storeId") || "default";
  }, [searchParams]);

  const [summary, setSummary] = useState<ParsedAudit | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);

  function handleParsed(parsed: ParsedAudit) {
    // ✅ Update summary section
    setSummary(parsed);

    // ✅ First upload → load rows
    if (rows.length === 0) {
      setRows(parsed.rows ?? []);
      return;
    }

    // ✅ Subsequent uploads → update ONLY sales column
    setRows((prev) => mergeSalesOnly(prev, parsed.rows ?? []));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* LEFT SIDE */}
      <div className="space-y-4">
        {/* SUMMARY */}
        <Card title="Daily Summary">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <SummaryItem label="Opening Balance" value={summary?.openingBalance} />
            <SummaryItem label="Total Sales" value={summary?.totalSales} />
            <SummaryItem label="Office Cash (Night)" value={summary?.officeCashNight} />
            <SummaryItem label="Office Cash (Sheet)" value={summary?.officeCashSheet} />
            <SummaryItem label="Expenditure" value={summary?.expenditure} />
            <SummaryItem label="Balance" value={summary?.balance} />
          </div>

          <div className="mt-3 text-xs text-zinc-500">
            Store: <span className="font-medium text-zinc-700">{storeId}</span>
          </div>
        </Card>

        {/* PDF UPLOAD */}
        <PdfUpload storeId={storeId} onParsed={handleParsed} />
      </div>

      {/* RIGHT SIDE */}
      <div>
        <Card title="Sales Sheet">
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-zinc-100">
                <tr>
                  <th className="border px-2 py-1 text-left">Brand</th>
                  <th className="border px-2 py-1 text-right">Size (ml)</th>
                  <th className="border px-2 py-1 text-right">Opening</th>
                  <th className="border px-2 py-1 text-right">Received</th>
                  <th className="border px-2 py-1 text-right">Sales</th>
                  <th className="border px-2 py-1 text-right">Closing</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={keyOfRow(r)}>
                    <td className="border px-2 py-1">{r.brandName}</td>
                    <td className="border px-2 py-1 text-right">{r.sizeMl}</td>
                    <td className="border px-2 py-1 text-right">{r.opening}</td>
                    <td className="border px-2 py-1 text-right">{r.received}</td>
                    <td className="border px-2 py-1 text-right font-semibold">{r.sold}</td>
                    <td className="border px-2 py-1 text-right">{r.closing}</td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-zinc-500">
                      Upload today’s PDF to populate data
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
