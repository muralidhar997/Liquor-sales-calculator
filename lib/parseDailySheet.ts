// lib/parseDailySheet.ts

export type ParsedLineItem = {
  brandName: string;
  sizeMl?: number;

  opening?: number;
  received?: number;
  total?: number;
  others?: number;
  closing?: number;

  salesQty?: number;
  rate?: number;
  salesAmount?: number;
};

export type ParsedRow = {
  brandName: string;
  sizeMl: number;
  opening: number;
  received: number;
  sold: number;
  closing: number;
};

export type ParsedAudit = {
  auditDate?: string; // YYYY-MM-DD
  openingBalance?: number;
  totalSales?: number;
  officeCashNight?: number;
  officeCashSheet?: number;
  expenditure?: number;
  balance?: number;

  lineItems: ParsedLineItem[];
  rows: ParsedRow[];

  rawText: string;
};

function toNumber(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const cleaned = s.replace(/[, ]/g, "").replace(/O/g, "0");
  const m = cleaned.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : undefined;
}

function findMoney(text: string, label: RegExp) {
  const m = text.match(label);
  return m ? toNumber(m[1]) : undefined;
}

function safeInt(n: number | undefined): number {
  if (n === undefined || Number.isNaN(n)) return 0;
  // most of your sheet columns are counts; round safely
  return Math.round(n);
}

function inferSizeMl(brand: string): number | undefined {
  const m = brand.match(/\b(180|200|275|300|330|375|500|650|700|720|750|900|1000|1500|1800|2000)\b/);
  return m ? Number(m[1]) : undefined;
}

function buildRows(lineItems: ParsedLineItem[]): ParsedRow[] {
  return lineItems.map((li) => {
    const sizeMl = li.sizeMl ?? inferSizeMl(li.brandName) ?? 0;

    return {
      brandName: li.brandName,
      sizeMl,
      opening: safeInt(li.opening),
      received: safeInt(li.received),
      sold: safeInt(li.salesQty),
      closing: safeInt(li.closing),
    };
  });
}

export function parseDailySheetText(rawText: string): ParsedAudit {
  const text = rawText
    .replace(/\r/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/\t/g, " ")
    .replace(/ +/g, " ")
    .trim();

  // Date heuristic (DD/MM/YYYY or DD-MM-YYYY)
  let auditDate: string | undefined;
  const dm = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dm) {
    const d = dm[1].padStart(2, "0");
    const m = dm[2].padStart(2, "0");
    const y = dm[3].length === 2 ? "20" + dm[3] : dm[3];
    auditDate = `${y}-${m}-${d}`;
  }

  // Summary fields (OCR is noisy; keep regex flexible)
  const openingBalance = findMoney(text, /Opening\s*Balance\s*[:\-]?\s*(\d[\d, .O-]*)/i);

  const officeCashNight =
    findMoney(text, /Office\s*Cash\s*\(?\s*Night\s*\)?\s*[:\-]?\s*(\d[\d, .O-]*)/i) ??
    findMoney(text, /Office\s*Cash\s*Night\s*[:\-]?\s*(\d[\d, .O-]*)/i);

  const officeCashSheet =
    findMoney(text, /Office\s*Cash\s*\(?\s*Sheet\s*\)?\s*[:\-]?\s*(\d[\d, .O-]*)/i) ??
    findMoney(text, /Office\s*Cash\s*Sheet\s*[:\-]?\s*(\d[\d, .O-]*)/i);

  const expenditure = findMoney(text, /Expendit\w*\s*[:\-]?\s*(\d[\d, .O-]*)/i);
  const balance = findMoney(text, /Balance\s*[:\-]?\s*(\d[\d, .O-]*)/i);

  // Total sales often appears as "Total Sales" or "Sales Amount Total"
  const totalSales =
    findMoney(text, /Total\s*Sales\s*[:\-]?\s*(\d[\d, .O-]*)/i) ??
    findMoney(text, /Sales\s*Amount\s*Total\s*[:\-]?\s*(\d[\d, .O-]*)/i);

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const lineItems: ParsedLineItem[] = [];

  for (const line of lines) {
    // Skip headers
    if (/DAILY\s*SHEET|BRAND|O\.B|OPENING|RECEIVED|TOTAL\b/i.test(line)) continue;

    // Extract all numbers
    const nums = Array.from(line.matchAll(/-?\d+(?:\.\d+)?/g)).map((m) => Number(m[0]));
    if (nums.length < 5) continue;

    // Brand part: remove trailing numeric chunks (best effort)
    const brandPart = line.replace(/(-?\d+(?:\.\d+)?[ ,]*){5,}$/g, "").trim();
    if (brandPart.length < 2) continue;

    const sizeMl = inferSizeMl(brandPart);

    // Best-effort mapping:
    // We assume the *last* number is salesAmount, then rate, then salesQty.
    const salesAmount = nums[nums.length - 1];
    const rate = nums.length >= 2 ? nums[nums.length - 2] : undefined;
    const salesQty = nums.length >= 3 ? nums[nums.length - 3] : undefined;

    // Earlier columns (best effort)
    const closing = nums.length >= 4 ? nums[nums.length - 4] : undefined;
    const others = nums.length >= 5 ? nums[nums.length - 5] : undefined;

    // First columns typically:
    const opening = nums[0];
    const received = nums[1];
    const total = nums[2];

    lineItems.push({
      brandName: brandPart,
      sizeMl,
      opening,
      received,
      total,
      others,
      closing,
      salesQty,
      rate,
      salesAmount,
    });
  }

  const rows = buildRows(lineItems);

  return {
    auditDate,
    openingBalance,
    totalSales,
    officeCashNight,
    officeCashSheet,
    expenditure,
    balance,
    lineItems,
    rows,
    rawText,
  };
}
