export type ParsedRow = {
  brandName: string;
  opening?: number;
  received?: number;
  total?: number;
  others?: number;
  closing?: number;
  salesQty?: number;
  rate?: number;
  salesAmount?: number; // ✅ this is what you want to update
};

export type ParsedAudit = {
  auditDate?: string; // YYYY-MM-DD (you will also pick date in UI)
  openingBalance?: number;
  totalSales?: number;
  officeCashNight?: number;
  officeCashSheet?: number;
  expenditure?: number;
  balance?: number;

  rows: ParsedRow[];
  rawText: string;
};

/* ---------------- helpers ---------------- */

function toNumber(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const cleaned = s
    .replace(/[, ]/g, "")
    .replace(/O/g, "0")
    .replace(/o/g, "0");
  const m = cleaned.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : undefined;
}

function cleanOcrText(raw: string) {
  return raw
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{2,}/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    // ✅ drop noisy single-letter OCR lines
    .filter((l) => !/^(Q|P|N)$/i.test(l))
    .join("\n");
}

function findMoney(text: string, label: RegExp) {
  const m = text.match(label);
  return m ? toNumber(m[1]) : undefined;
}

/**
 * Extract row lines that come AFTER the known header.
 * Your header:
 * "Sl. No. Brand Name O.B Received Total Others C.B Sales Rate Sales Amount"
 */
function extractRowLines(text: string): string[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const headerIdx = lines.findIndex((l) =>
    /Sl\.\s*No\.\s*Brand\s*Name\s*O\.?B\s*Received\s*Total\s*Others\s*C\.?B\s*Sales\s*Rate\s*Sales\s*Amount/i.test(l)
  );

  if (headerIdx === -1) {
    // fallback: try looser header detection
    const looseIdx = lines.findIndex((l) =>
      /Brand\s*Name.*O\.?B.*Received.*Total.*C\.?B.*Sales.*Sales\s*Amount/i.test(l)
    );
    if (looseIdx === -1) return [];
    return lines.slice(looseIdx + 1);
  }

  return lines.slice(headerIdx + 1);
}

/**
 * Parse a single line like:
 * "1 civas regal  10  2  12  0  6  6  3500  21000"
 */
function parseRowLine(line: string): ParsedRow | null {
  // must start with serial number
  const m = line.match(/^(\d+)\s+(.*)$/);
  if (!m) return null;

  const rest = m[2].trim();

  // get all numeric tokens
  const nums = Array.from(rest.matchAll(/-?\d+(?:\.\d+)?/g)).map((x) => Number(x[0]));

  // We need at least these columns:
  // O.B, Received, Total, Others, C.B, Sales, Rate, SalesAmount  => 8 numbers
  if (nums.length < 6) return null;

  // brand text = everything before the first number chunk
  const firstNumPos = rest.search(/-?\d/);
  if (firstNumPos <= 0) return null;

  const brand = rest.slice(0, firstNumPos).trim();
  if (!brand) return null;

  // Map last columns best-effort:
  // Often last is Sales Amount, before that Rate, before that Sales Qty
  const salesAmount = nums.length >= 1 ? nums[nums.length - 1] : undefined;
  const rate = nums.length >= 2 ? nums[nums.length - 2] : undefined;
  const salesQty = nums.length >= 3 ? nums[nums.length - 3] : undefined;

  // Earlier columns (best effort, depends on sheet)
  // We'll take from start:
  const opening = nums[0];
  const received = nums[1];
  const total = nums[2];
  const others = nums[3];
  const closing = nums[4];

  return {
    brandName: brand,
    opening,
    received,
    total,
    others,
    closing,
    salesQty,
    rate,
    salesAmount,
  };
}

export function parseDailySheetText(rawText: string): ParsedAudit {
  const text = cleanOcrText(rawText);

  // Summary fields (keep flexible; if not present we still compute totalSales from rows)
  const openingBalance = findMoney(text, /Opening\s*Balance\s*[:\-]?\s*(\d[\d, .O-]*)/i);
  const officeCashNight =
    findMoney(text, /Office\s*Cash\s*\(?\s*Night\s*\)?\s*[:\-]?\s*(\d[\d, .O-]*)/i) ??
    findMoney(text, /Office\s*Cash\s*Night\s*[:\-]?\s*(\d[\d, .O-]*)/i);

  const officeCashSheet =
    findMoney(text, /Office\s*Cash\s*\(?\s*Sheet\s*\)?\s*[:\-]?\s*(\d[\d, .O-]*)/i) ??
    findMoney(text, /Office\s*Cash\s*Sheet\s*[:\-]?\s*(\d[\d, .O-]*)/i);

  const expenditure = findMoney(text, /Expendit\w*\s*[:\-]?\s*(\d[\d, .O-]*)/i);
  const balance = findMoney(text, /Balance\s*[:\-]?\s*(\d[\d, .O-]*)/i);

  // Rows
  const rowLines = extractRowLines(text);
  const rows: ParsedRow[] = [];

  for (const line of rowLines) {
    // stop if we hit footer-ish text
    if (/^Total\b|^Grand\b|^Signature\b/i.test(line)) break;

    const parsed = parseRowLine(line);
    if (parsed) rows.push(parsed);
  }

  // totalSales: prefer from sheet if present, otherwise sum Sales Amount
  const sheetTotalSales =
    findMoney(text, /Total\s*Sales\s*[:\-]?\s*(\d[\d, .O-]*)/i) ??
    findMoney(text, /Sales\s*Amount\s*Total\s*[:\-]?\s*(\d[\d, .O-]*)/i);

  const computedTotalSales = rows.reduce((sum, r) => sum + (r.salesAmount ?? 0), 0);
  const totalSales = sheetTotalSales ?? (computedTotalSales > 0 ? computedTotalSales : undefined);

  return {
    openingBalance,
    totalSales,
    officeCashNight,
    officeCashSheet,
    expenditure,
    balance,
    rows,
    rawText,
  };
}
