"use client";

import { useEffect, useMemo, useState } from "react";
import PdfUpload from "./PdfUpload";
import { Card } from "./ui";
import type { ParsedAudit, ParsedRow } from "../lib/parseDailySheet";
import { supabase } from "../lib/supabase";


/* ---------------- helpers ---------------- */

function keyOfRow(r: ParsedRow) {
  return (r.brandName ?? "").trim().toLowerCase();
}

/**
 * Merge ONLY salesAmount (Sales Amount money) from new rows
 */
function mergeSalesAmountOnly(existing: ParsedRow[], incoming: ParsedRow[]): ParsedRow[] {
  const map = new Map(incoming.map((r) => [keyOfRow(r), r]));

  return existing.map((row) => {
    const newer = map.get(keyOfRow(row));
    if (!newer) return row;

    return {
      ...row,
      salesAmount: newer.salesAmount ?? row.salesAmount,
    };
  });
}

function keepLast30ByDate(files: StoredPdf[]) {
  // file.name is YYYY-MM-DD.pdf
  const sorted = [...files].sort((a, b) => (a.date < b.date ? 1 : -1));
  return sorted.slice(0, 30);
}

type StoredPdf = {
  name: string; // YYYY-MM-DD.pdf
  date: string; // YYYY-MM-DD
  path: string; // storeId/name
  signedUrl?: string;
};

/* ---------------- component ---------------- */

export default function UserDashboard() {
  // ✅ since storeId = 4-digit user id, you can later pass it from your login/session
  // For now, set it here OR wire it from your auth state.
  const storeId = "0000"; // 🔴 CHANGE THIS: replace with the actual logged-in user id

  const [summary, setSummary] = useState<ParsedAudit | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [recentPdfs, setRecentPdfs] = useState<StoredPdf[]>([]);
  const [pdfError, setPdfError] = useState<string>("");

  const validStoreId = useMemo(() => /^\d{4}$/.test(storeId), [storeId]);

  async function loadRecentPdfs() {
    setPdfError("");
    if (!validStoreId) return;

    const { data, error } = await supabase.storage.from("daily-sheets").list(storeId, {
      limit: 100,
      offset: 0,
      sortBy: { column: "name", order: "desc" },
    });

    if (error) {
      setPdfError(error.message);
      return;
    }

    const mapped: StoredPdf[] =
      (data ?? [])
        .filter((x) => x.name?.toLowerCase().endsWith(".pdf"))
        .map((x) => {
          const name = x.name;
          const date = name.replace(/\.pdf$/i, "");
          return { name, date, path: `${storeId}/${name}` };
        })
        .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.date)) ?? [];

    setRecentPdfs(keepLast30ByDate(mapped));
  }

  async function signUrl(path: string) {
    const { data, error } = await supabase.storage.from("daily-sheets").createSignedUrl(path, 60 * 20);
    if (error) throw error;
    return data.signedUrl;
  }

  useEffect(() => {
    if (!validStoreId) return;
    loadRecentPdfs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validStoreId]);

  function handleParsed(parsed: ParsedAudit) {
    // ✅ Always update summary with latest parsed PDF
    setSummary(parsed);

    // ✅ First upload: load all rows
    if (rows.length === 0) {
      setRows(parsed.rows);
      return;
    }

    // ✅ Next uploads: update ONLY Sales Amount
    setRows((prev) => mergeSalesAmountOnly(prev, parsed.rows));
  }

  async function handleParsedWithInfo(
    parsed: ParsedAudit,
    info: { date: string; uploadedPath?: string; localUrl?: string }
  ) {
    handleParsed(parsed);

    // refresh list after upload
    await loadRecentPdfs();
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

          <div className="mt-3 text-xs text-zinc-600">
            StoreId: <span className="font-semibold">{storeId}</span>
          </div>

          {!validStoreId ? (
            <div className="mt-2 text-xs text-red-600">
              Set storeId in UserDashboard.tsx to a 4-digit id (your user id).
            </div>
          ) : null}
        </Card>

        {/* PDF UPLOAD */}
        <PdfUpload storeId={storeId} onParsed={handleParsedWithInfo} />

        {/* RECENT PDF LIST */}
        <Card title="Last 30 uploaded PDFs">
          {pdfError ? <div className="text-sm text-red-600">{pdfError}</div> : null}

          {recentPdfs.length === 0 ? (
            <div className="text-sm text-zinc-600">No PDFs uploaded yet.</div>
          ) : (
            <div className="space-y-2">
              {recentPdfs.map((f) => (
                <div key={f.path} className="flex items-center justify-between gap-2">
                  <div className="text-sm">{f.date}</div>
                  <button
                    className="text-sm underline"
                    onClick={async () => {
                      try {
                        const url = await signUrl(f.path);
                        window.open(url, "_blank");
                      } catch (e: any) {
                        alert(e?.message ?? "Failed to open PDF");
                      }
                    }}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* RIGHT SIDE */}
      <div>
        <Card title="Sales Sheet (Sales Amount updates on upload)">
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-zinc-100">
                <tr>
                  <th className="border px-2 py-1 text-left">Brand</th>
                  <th className="border px-2 py-1 text-right">Opening</th>
                  <th className="border px-2 py-1 text-right">Received</th>
                  <th className="border px-2 py-1 text-right">Closing</th>
                  <th className="border px-2 py-1 text-right">Sales Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={keyOfRow(r)}>
                    <td className="border px-2 py-1">{r.brandName}</td>
                    <td className="border px-2 py-1 text-right">{r.opening ?? "—"}</td>
                    <td className="border px-2 py-1 text-right">{r.received ?? "—"}</td>
                    <td className="border px-2 py-1 text-right">{r.closing ?? "—"}</td>
                    <td className="border px-2 py-1 text-right font-semibold">
                      {r.salesAmount ?? "—"}
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-zinc-500">
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

