"use client";

import { useState } from "react";
import { Button, Card } from "./ui";
import { parseDailySheetText, type ParsedAudit } from "../lib/parseDailySheet";

// pdf.js + tesseract
import * as pdfjs from "pdfjs-dist";
import Tesseract from "tesseract.js";

// Use CDN worker to avoid bundling issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(pdfjs as any).GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

export default function PdfUpload({ onParsed }: { onParsed: (p: ParsedAudit) => void }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [lastTextSize, setLastTextSize] = useState<number>(0);

  async function ocrPdf(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
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
        }
      });

      allText += "\n" + (data.text ?? "");
    }

    return allText.trim();
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/pdf$/i.test(file.name)) {
      setError("Please upload a PDF file.");
      return;
    }

    setBusy(true);
    setProgress("Starting…");
    try {
      const text = await ocrPdf(file);
      setLastTextSize(text.length);
      const parsed = parseDailySheetText(text);
      onParsed(parsed);
      setProgress("Done. Fields updated.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to OCR/parse PDF");
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(""), 2500);
      e.target.value = "";
    }
  }

  return (
    <Card title="Upload today’s sheet (PDF)">
      <div className="space-y-3">
        <input type="file" accept="application/pdf" onChange={onPick} disabled={busy} />
        {busy ? <div className="text-sm text-zinc-700">{progress}</div> : null}
        {!busy && progress ? <div className="text-sm text-zinc-700">{progress}</div> : null}
        {lastTextSize ? <div className="text-xs text-zinc-600">OCR text size: {lastTextSize} chars</div> : null}
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        <div className="text-xs text-zinc-600">
          Tip: If OCR misses a field, you can edit values in the Summary before saving.
        </div>
      </div>
    </Card>
  );
}
