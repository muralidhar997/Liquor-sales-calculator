"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Button, Card } from "./ui";
import { parseDailySheetText, type ParsedAudit } from "../lib/parseDailySheet";

import * as pdfjs from "pdfjs-dist";
import Tesseract from "tesseract.js";

// ✅ IMPORTANT: match your installed pdfjs-dist version (4.4.168)
const PDFJS_WORKER =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

// pdfjs needs workerSrc set in browser
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(pdfjs as any).GlobalWorkerOptions.workerSrc = PDFJS_WORKER;

type Props = {
  onParsed: (p: ParsedAudit, meta: { auditDate: string; file: File; previewUrl: string }) => void;
};

export default function PdfUpload({ onParsed }: Props) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // ✅ date select BEFORE uploading
  const [auditDate, setAuditDate] = useState<string>(() => {
    const d = new Date();
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [previewUrl, setPreviewUrl] = useState<string>("");

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function extractTextFromPdf(buf: ArrayBuffer): Promise<string> {
    const doc = await pdfjs.getDocument({ data: buf }).promise;

    let combined = "";
    for (let i = 1; i <= doc.numPages; i++) {
      setProgress(`Reading text from page ${i}/${doc.numPages}…`);
      const page = await doc.getPage(i);

      // Try native text extraction first (fast)
      try {
        const content = await page.getTextContent();
        const pageText = content.items
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((it: any) => (it.str ? String(it.str) : ""))
          .join(" ");
        combined += "\n" + pageText;
      } catch {
        // ignore, OCR fallback will handle
      }
    }

    return combined.trim();
  }

  async function ocrPdf(buf: ArrayBuffer): Promise<string> {
    const doc = await pdfjs.getDocument({ data: buf }).promise;

    let allText = "";
    for (let i = 1; i <= doc.numPages; i++) {
      setProgress(`Rendering page ${i}/${doc.numPages}…`);
      const page = await doc.getPage(i);

      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context not available");

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport }).promise;

      setProgress(`OCR page ${i}/${doc.numPages}…`);
      const { data } = await Tesseract.recognize(canvas, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setProgress(`OCR page ${i}/${doc.numPages}… ${(m.progress * 100).toFixed(0)}%`);
          }
        },
      });

      allText += "\n" + (data.text ?? "");
    }

    return allText.trim();
  }

  async function parseFile(file: File) {
    const buf = await file.arrayBuffer();

    // 1) Try text extraction
    const text = await extractTextFromPdf(buf);

    // 2) If too little text → OCR
    if (!text || text.length < 80) {
      const ocrText = await ocrPdf(buf);
      return ocrText;
    }

    return text;
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!/pdf$/i.test(file.name)) {
      setError("Please upload a PDF file.");
      return;
    }

    if (!auditDate) {
      setError("Please select an Audit Date first.");
      return;
    }

    // Preview URL
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    setBusy(true);
    setProgress("Starting…");

    try {
      const rawText = await parseFile(file);

      const parsed = parseDailySheetText(rawText);

      // ✅ override parsed auditDate with selected date (your requirement)
      const finalParsed: ParsedAudit = {
        ...parsed,
        auditDate,
      };

      onParsed(finalParsed, { auditDate, file, previewUrl: url });

      setProgress("Done. Summary + Sales updated.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to read/parse PDF";
      setError(msg);
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(""), 2500);
      e.target.value = "";
    }
  }

  const canPick = useMemo(() => !busy, [busy]);

  return (
    <Card title="Upload today’s sheet (PDF)">
      <div className="space-y-3">
        {/* Date select BEFORE upload */}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <div className="text-xs text-zinc-600 mb-1">Audit Date</div>
            <input
              type="date"
              className="w-full rounded border px-3 py-2 text-sm"
              value={auditDate}
              onChange={(e) => setAuditDate(e.target.value)}
              disabled={busy}
            />
          </div>

          <div>
            <div className="text-xs text-zinc-600 mb-1">PDF</div>
            <input type="file" accept="application/pdf" onChange={onPick} disabled={!canPick} />
          </div>
        </div>

        {progress ? <div className="text-sm text-zinc-700">{progress}</div> : null}
        {error ? <div className="text-sm text-red-600">{error}</div> : null}

        {/* PDF preview */}
        {previewUrl ? (
          <div className="rounded border overflow-hidden">
            <div className="px-3 py-2 text-xs text-zinc-600 bg-zinc-50 flex items-center justify-between">
              <div>Preview</div>
              <a className="underline" href={previewUrl} target="_blank" rel="noreferrer">
                Open in new tab
              </a>
            </div>
            <iframe title="PDF Preview" src={previewUrl} className="w-full h-[380px]" />
          </div>
        ) : null}

        <div className="text-xs text-zinc-600">
          Tip: If a field is missing, you can still edit manually — but after this update, the sheet rows should read cleanly.
        </div>
      </div>
    </Card>
  );
}


