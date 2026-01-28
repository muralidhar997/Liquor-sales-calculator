import { Card } from "./ui";
import type { ParsedLineItem } from "../lib/parseDailySheet";

export default function BalanceSheet({ lineItems }: { lineItems: ParsedLineItem[] }) {
  return (
    <Card title="Balance Sheet View">
      {!lineItems?.length ? (
        <div className="text-sm text-zinc-600">Upload a PDF to see line items here.</div>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left border-b border-zinc-200">
                <th className="py-2 pr-3">Brand</th>
                <th className="py-2 pr-3">OB</th>
                <th className="py-2 pr-3">Rec</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2 pr-3">Others</th>
                <th className="py-2 pr-3">CB</th>
                <th className="py-2 pr-3">Sales</th>
                <th className="py-2 pr-3">Rate</th>
                <th className="py-2 pr-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((r, idx) => (
                <tr key={idx} className="border-b border-zinc-100">
                  <td className="py-2 pr-3 whitespace-nowrap">{r.brandName}</td>
                  <td className="py-2 pr-3">{r.opening ?? ""}</td>
                  <td className="py-2 pr-3">{r.received ?? ""}</td>
                  <td className="py-2 pr-3">{r.total ?? ""}</td>
                  <td className="py-2 pr-3">{r.others ?? ""}</td>
                  <td className="py-2 pr-3">{r.closing ?? ""}</td>
                  <td className="py-2 pr-3">{r.salesQty ?? ""}</td>
                  <td className="py-2 pr-3">{r.rate ?? ""}</td>
                  <td className="py-2 pr-3">{r.salesAmount ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
