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

export type ParsedAudit = {
  auditDate?: string; // YYYY-MM-DD
  openingBalance?: number;
  totalSales?: number;
  officeCashNight?: number;
  officeCashSheet?: number;
  expenditure?: number;
  balance?: number;
  lineItems: ParsedLineItem[];
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
  const officeCashNight = findMoney(text, /Office\s*Cash\s*\(?\s*Night\s*\)?\s*[:\-]?\s*(\d[\d, .O-]*)/i)
    ?? findMoney(text, /Office\s*Cash\s*Night\s*[:\-]?\s*(\d[\d, .O-]*)/i);
  const officeCashSheet = findMoney(text, /Office\s*Cash\s*\(?\s*Sheet\s*\)?\s*[:\-]?\s*(\d[\d, .O-]*)/i)
    ?? findMoney(text, /Office\s*Cash\s*Sheet\s*[:\-]?\s*(\d[\d, .O-]*)/i);
  const expenditure = findMoney(text, /Expendit\w*\s*[:\-]?\s*(\d[\d, .O-]*)/i);
  const balance = findMoney(text, /Balance\s*[:\-]?\s*(\d[\d, .O-]*)/i);

  // Total sales often appears as "Sales Amount" total or "Total Sales"
  const totalSales =
    findMoney(text, /Total\s*Sales\s*[:\-]?\s*(\d[\d, .O-]*)/i) ??
    findMoney(text, /Sales\s*Amount\s*Total\s*[:\-]?\s*(\d[\d, .O-]*)/i);

  // Line items heuristic:
  // Look for lines that end with a money amount and contain multiple numeric columns.
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const lineItems: ParsedLineItem[] = [];
  for (const line of lines) {
    // Skip headers
    if (/DAILY\s*SHEET|BRAND|O\.B|OPENING|RECEIVED|TOTAL\b/i.test(line)) continue;

    // Common pattern: <brand words> <maybe size> <ob> <received> <total> <others> <cb> <sales> <rate> <sales amount>
    // We'll extract all numbers from the line and keep the left part as brand.
    const nums = Array.from(line.matchAll(/-?\d+(?:\.\d+)?/g)).map(m => Number(m[0]));
    if (nums.length < 5) continue;

    const last = nums[nums.length - 1];
    // likely sales amount should be fairly large; ignore tiny lines
    if (!(last >= 1)) continue;

    // Brand name: remove trailing numeric chunks
    const brandPart = line.replace(/(-?\d+(?:\.\d+)?[ ,]*){5,}$/g, "").trim();
    if (brandPart.length < 2) continue;

    // Try to infer size if present (180, 375, 750, 1000, 2000, etc.)
    const sizeMatch = brandPart.match(/\b(180|200|275|300|330|375|500|650|700|720|750|900|1000|1500|1800|2000)\b/);
    const sizeMl = sizeMatch ? Number(sizeMatch[1]) : undefined;

    // Map last columns (best-effort)
    // We'll take last 4 as: salesQty, rate, salesAmount, and one before as closing or cb depending on sheet
    const salesAmount = last;
    const rate = nums.length >= 2 ? nums[nums.length - 2] : undefined;
    const salesQty = nums.length >= 3 ? nums[nums.length - 3] : undefined;

    // Earlier columns:
    const closing = nums.length >= 4 ? nums[nums.length - 4] : undefined;
    const others = nums.length >= 5 ? nums[nums.length - 5] : undefined;

    // First three numbers after brand often are OB, Received, Total
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
      salesAmount
    });
  }

  return {
    auditDate,
    openingBalance,
    totalSales,
    officeCashNight,
    officeCashSheet,
    expenditure,
    balance,
    lineItems,
    rawText
  };
}
