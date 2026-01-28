"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, FieldRow, Input } from "./ui";
import PdfUpload from "./PdfUpload";
import BalanceSheet from "./BalanceSheet";
import type { ParsedAudit } from "../lib/parseDailySheet";

type StoreInfo = { storeId: string; storeName: string; code4: string };

export default function UserDashboard() {
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // summary fields (editable)
  // labels requested: total, opening balance, total, office cash( night), office cash(sheet), expenditure and balance
  const [openingBalance, setOpeningBalance] = useState("");
  const [totalSales, setTotalSales] = useState("");
  const [officeCashNight, setOfficeCashNight] = useState("");
  const [officeCashSheet, setOfficeCashSheet] = useState("");
  const [expenditure, setExpenditure] = useState("");
  const [balance, setBalance] = useState("");

  const [lineItems, setLineItems] = useState<ParsedAudit["lineItems"]>([]);
  const [auditDate, setAuditDate] = useState<string>("");

  const computedBalance = useMemo(() => {
    const ob = Number(openingBalance || 0);
    const sales = Number(totalSales || 0);
    const night = Number(officeCashNight || 0);
    const sheet = Number(officeCashSheet || 0);
    const exp = Number(expenditure || 0);
    // Balance is often: (ob + sales) - (night + sheet + exp)
    const b = (ob + sales) - (night + sheet + exp);
    if ([ob, sales, night, sheet, exp].some(n => Number.isNaN(n))) return null;
    return b;
  }, [openingBalance, totalSales, officeCashNight, officeCashSheet, expenditure]);

  const computedTotal2 = useMemo(() => {
    const ob = Number(openingBalance || 0);
    const sales = Number(totalSales || 0);
    if ([ob, sales].some(n => Number.isNaN(n))) return null;
    return ob + sales;
  }, [openingBalance, totalSales]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/me");
      if (!res.ok) {
        window.location.href = "/";
        return;
      }
      const data = await res.json();
      setStore(data.store);
      setLoading(false);
    })();
  }, []);

  function applyParsed(parsed: ParsedAudit) {
    if (parsed.auditDate) setAuditDate(parsed.auditDate);
    if (parsed.openingBalance != null) setOpeningBalance(String(parsed.openingBalance));
    if (parsed.totalSales != null) setTotalSales(String(parsed.totalSales));
    if (parsed.officeCashNight != null) setOfficeCashNight(String(parsed.officeCashNight));
    if (parsed.officeCashSheet != null) setOfficeCashSheet(String(parsed.officeCashSheet));
    if (parsed.expenditure != null) setExpenditure(String(parsed.expenditure));
    if (parsed.balance != null) setBalance(String(parsed.balance));
    setLineItems(parsed.lineItems);
  }

  function clearForm() {
    setOpeningBalance("");
    setTotalSales("");
    setOfficeCashNight("");
    setOfficeCashSheet("");
    setExpenditure("");
    setBalance("");
    setLineItems([]);
  }

  async function loadAudit(forDate: string) {
    if (!forDate) return;
    const res = await fetch(`/api/audits?date=${encodeURIComponent(forDate)}`);
    const data = await res.json();
    if (!res.ok) {
      alert(data?.error ?? "Failed to load");
      return;
    }
    if (!data?.audit) {
      clearForm();
      setAuditDate(forDate);
      alert("No audit saved for this date.");
      return;
    }
    applyParsed(data.audit);
  }

  async function exportMonth(forMonth: string) {
    if (!forMonth) return;
    // triggers a file download
    window.location.href = `/api/audits/export?month=${encodeURIComponent(forMonth)}`;
  }

  async function saveAudit() {
    const payload = {
      auditDate: auditDate || null,
      openingBalance: Number(openingBalance || 0),
      totalSales: Number(totalSales || 0),
      officeCashNight: Number(officeCashNight || 0),
      officeCashSheet: Number(officeCashSheet || 0),
      expenditure: Number(expenditure || 0),
      balance: balance ? Number(balance) : (computedBalance ?? 0),
      lineItems
    };

    const res = await fetch("/api/audits", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data?.error ?? "Failed to save");
      return;
    }
    alert("Saved!");
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/";
  }

  if (loading) return <div className="text-sm text-zinc-600">Loading…</div>;
  if (!store) return null;

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      <section className="lg:w-1/2 space-y-4">
        <Card title={`Store: ${store.storeName} (Code ${store.code4})`}>
          <div className="flex items-center justify-between">
            <div className="text-xs text-zinc-600">Upload today's sheet and save the audit.</div>
            <Button variant="ghost" onClick={logout}>Logout</Button>
          </div>
        </Card>

        <Card title="Summary">
          <div className="space-y-3">
            <FieldRow>
              <Input label="total" value={totalSales} onChange={e=>setTotalSales(e.target.value)} inputMode="decimal" />
              <Input label="opening balance" value={openingBalance} onChange={e=>setOpeningBalance(e.target.value)} inputMode="decimal" />
            </FieldRow>
            <FieldRow>
              <Input
                label="total"
                value={computedTotal2 != null ? String(computedTotal2) : ""}
                readOnly
                placeholder={computedTotal2 != null ? String(computedTotal2) : ""}
              />
              <Input label="office cash( night)" value={officeCashNight} onChange={e=>setOfficeCashNight(e.target.value)} inputMode="decimal" />
            </FieldRow>
            <FieldRow>
              <Input label="office cash(sheet)" value={officeCashSheet} onChange={e=>setOfficeCashSheet(e.target.value)} inputMode="decimal" />
              <Input label="expenditure" value={expenditure} onChange={e=>setExpenditure(e.target.value)} inputMode="decimal" />
            </FieldRow>
            <FieldRow>
              <Input
                label="balance"
                value={balance}
                onChange={e=>setBalance(e.target.value)}
                inputMode="decimal"
                placeholder={computedBalance != null ? String(computedBalance) : ""}
              />
              <div className="flex items-end gap-2">
                <Button onClick={saveAudit}>Save</Button>
              </div>
            </FieldRow>

            <FieldRow>
              <Input
                label="Audit Date"
                type="date"
                value={auditDate}
                onChange={e => setAuditDate(e.target.value)}
              />
              <div className="flex items-end gap-2">
                <Button variant="ghost" onClick={() => loadAudit(auditDate)}>Load</Button>
                <Button variant="ghost" onClick={clearForm}>Clear</Button>
              </div>
            </FieldRow>

            <FieldRow>
              <Input
                label="Export Month"
                type="month"
                defaultValue={auditDate ? auditDate.slice(0, 7) : ""}
                onChange={(e) => exportMonth(e.target.value)}
              />
              <div className="text-xs text-zinc-600 flex items-end">
                Select a month to download CSV.
              </div>
            </FieldRow>
            {computedBalance != null ? (
              <div className="text-xs text-zinc-600">
                Computed Balance (preview): <span className="font-medium">{computedBalance}</span>
              </div>
            ) : null}
          </div>
        </Card>

        <PdfUpload onParsed={applyParsed} />
      </section>

      <aside className="lg:w-1/2 space-y-4">
        <BalanceSheet lineItems={lineItems} />
      </aside>
    </div>
  );
}
