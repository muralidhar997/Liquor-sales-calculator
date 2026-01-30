// lib/parseDailySheet.ts

export type ParsedLineItem = {
  brandName: string;
  sizeMl?: number;
  opening?: number;
  received?: number;
  total?: number;
  others?: number;
  closing?: number;
  salesQty?: number;      // ✅ Sales quantity
  rate?: number;
  salesAmount?: number;   // still captured (optional), but UI uses salesQty
};

export type ParsedRow = {
  brandName: string;
  sizeMl: number;
  opening: number;
  received: number;
  total: number;
  others: number;
  closing: number;
  salesQty: number; // ✅ used in table + merge
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

/**
 * Remove common OCR junk tokens like isolated Q/P/N and repeated separators.
 */
function normalizeText(rawText: string) {
  return rawText
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[|]/g, " ")
    .replace(/\n{2,}/g, "\n")
    .replace(/ +/g, " ")
    .trim();
}

function cleanBrandName(s: string) {
  return s
    .replace(/^\d+\s+/, "") // remove leading serial number
    .replace(/\b(Q|P|N)\b/gi, " ") // remove stray OCR markers
    .replace(/[^\w\s&.'()-]/g, " ") // remove weird punctuation
    .replace(/ +/g, " ")
    .trim();
}

function inferSizeMl(brand: string): number | undefined {
  // try to find a known ml number in the brand text
  const m = brand.match(/\b(180|200|275|300|330|375|500|650|700|720|750|900|1000|1500|1800|2000)\b/);
  return m ? Number(m[1]) : undefined;
}

function isNoiseLine(line: string) {
  const t = line.trim();
  if (!t) return true;
  // lines that are only Q/P/N or very short junk
  if (/^(Q|P|N)$/i.test(t)) return true;
  // common header-ish lines
  if (/^Daily\s*Sheet/i.test(t)) return true;
  if (/Sl\.\s*No/i.test(t)) return true;
  if (/Brand\s*Name\s+O\.B/i.test(t)) return true;
  if (/Name\s+of\s+the\s+shop/i.test(t)) return true;
  return false;
}

/**
 * Parse the tabular section after the table header.
 * Expected columns:
 * Brand Name | O.B | Received | Total | Others | C.B | Sales | Rate | Sales Amount
 *
 * We mainly need: OB/Rec/Total/Others/CB/SalesQty (and optionally rate & salesAmount)
 */
function parseTableRows(text: string) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Find where the table starts (header line)
  const headerIdx = lines.findIndex((l) =>
    /Brand\s*Name/i.test(l) &&
    /\bO\.?B\b/i.test(l) &&
    /Received/i.test(l) &&
    /\bC\.?B\b/i.test(l) &&
    /\bSales\b/i.test(l)
  );

  const start = headerIdx >= 0 ? headerIdx + 1 : 0;

  const lineItems: ParsedLineItem[] = [];

  for (let i = start; i < lines.length; i++) {
    const line = lines[i];

    if (isNoiseLine(line)) continue;

    // Stop if we hit obvious summary section labels (depends on your sheet)
    if (/Opening\s*Balance|Office\s*Cash|Expendit|Balance|Total\s*Sales/i.test(line)) {
      break;
    }

    // Extract all numbers in the line
    const nums = Array.from(line.matchAll(/-?\d+(?:\.\d+)?/g)).map((m) => Number(m[0]));
    // If not enough numeric columns, skip
    if (nums.length < 5) continue;

    // Brand part = remove the numeric tail chunk (best effort)
    // We remove everything from the first of the last 5+ numbers onward.
    // Safer: remove last N numeric occurrences by regex
    const brandPart = cleanBrandName(
      line.replace(/(-?\d+(?:\.\d+)?\s*){5,}$/g, "").trim()
    );

    if (!brandPart || brandPart.length < 2) continue;

    const sizeMl = inferSizeMl(brandPart) ?? 750; // default 750 if not present
    // Columns from the END are more reliable than the start
    // Typical last columns: ... CB, SalesQty, Rate, SalesAmount
    // Sometimes SalesAmount missing, or rate missing. We handle flexibly.

    let opening: number | undefined;
    let received: number | undefined;
    let total: number | undefined;
    let others: number | undefined;
    let closing: number | undefined;
    let salesQty: number | undefined;
    let rate: number | undefined;
    let salesAmount: number | undefined;

    // If we have 8+ numbers assume:
    // [OB, Rec, Total, Others, CB, SalesQty, Rate, SalesAmount] (from the end)
    if (nums.length >= 8) {
      salesAmount = nums[nums.length - 1];
      rate = nums[nums.length - 2];
      salesQty = nums[nums.length - 3];
      closing = nums[nums.length - 4];
      others = nums[nums.length - 5];
      total = nums[nums.length - 6];
      received = nums[nums.length - 7];
      opening = nums[nums.length - 8];
    } else if (nums.length === 7) {
      // [OB, Rec, Total, Others, CB, SalesQty, Rate]
      rate = nums[nums.length - 1];
      salesQty = nums[nums.length - 2];
      closing = nums[nums.length - 3];
      others = nums[nums.length - 4];
      total = nums[nums.length - 5];
      received = nums[nums.length - 6];
      opening = nums[nums.length - 7];
    } else if (nums.length === 6) {
      // [OB, Rec, Total, Others, CB, SalesQty]
      salesQty = nums[nums.length - 1];
      closing = nums[nums.length - 2];
      others = nums[nums.length - 3];
      total = nums[nums.length - 4];
      received = nums[nums.length - 5];
      opening = nums[nums.length - 6];
    } else {
      // fallback: take first few
      opening = nums[0];
      received = nums[1];
      total = nums[2];
      others = nums[3];
      closing = nums[4];
      salesQty = nums[5] ?? 0;
    }

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

  // Convert to strict rows (numbers default to 0)
  const rows: ParsedRow[] = lineItems.map((x) => ({
    brandName: x.brandName,
    sizeMl: x.sizeMl ?? 750,
    opening: x.opening ?? 0,
    received: x.received ?? 0,
    total: x.total ?? 0,
    others: x.others ?? 0,
    closing: x.closing ?? 0,
    salesQty: x.salesQty ?? 0,
    rate: x.rate,
    salesAmount: x.salesAmount,
  }));

  return { lineItems, rows };
}

export function parseDailySheetText(rawText: string): ParsedAudit {
  const text = normalizeText(rawText);

  // Date heuristic (DD/MM/YYYY or DD-MM-YYYY)
  let auditDate: string | undefined;
  const dm = text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dm) {
    const d = dm[1].padStart(2, "0");
    const m = dm[2].padStart(2, "0");
    const y = dm[3].length === 2 ? "20" + dm[3] : dm[3];
    auditDate = `${y}-${m}-${d}`;
  }

  // Summary fields (kept flexible)
  const openingBalance = findMoney(text, /Opening\s*Balance\s*[:\-]?\s*(\d[\d, .O-]*)/i);
  const officeCashNight =
    findMoney(text, /Office\s*Cash\s*\(?\s*Night\s*\)?\s*[:\-]?\s*(\d[\d, .O-]*)/i) ??
    findMoney(text, /Office\s*Cash\s*Night\s*[:\-]?\s*(\d[\d, .O-]*)/i);

  const officeCashSheet =
    findMoney(text, /Office\s*Cash\s*\(?\s*Sheet\s*\)?\s*[:\-]?\s*(\d[\d, .O-]*)/i) ??
    findMoney(text, /Office\s*Cash\s*Sheet\s*[:\-]?\s*(\d[\d, .O-]*)/i);

  const expenditure = findMoney(text, /Expendit\w*\s*[:\-]?\s*(\d[\d, .O-]*)/i);
  const balance = findMoney(text, /Balance\s*[:\-]?\s*(\d[\d, .O-]*)/i);

  const totalSales =
    findMoney(text, /Total\s*Sales\s*[:\-]?\s*(\d[\d, .O-]*)/i) ??
    findMoney(text, /Sales\s*Amount\s*Total\s*[:\-]?\s*(\d[\d, .O-]*)/i);

  const { lineItems, rows } = parseTableRows(text);

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
