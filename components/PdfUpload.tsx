"use client";

import { useState } from "react";
import { Card } from "./ui";
import { parseDailySheetText, type ParsedAudit } from "../lib/parseDailySheet";

import * as pdfjs from "pdfjs-dist";
import Tesseract from "tesseract.js";

// ✅ pdf.js API + Worker BOTH locked to 4.4.168
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(pdfjs as any).GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

export default function PdfUpload({ onParsed }: { onParsed: (p: ParsedAudit) => void }) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastTextSize, setLastTextSize] = useState(0);

  async function ocrPdf(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();

    setProgress("Loading PDF…");
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;

    let text = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      setProgress(`Rendering page ${pageNum}/${pdf.numPages}…`);
      const page = await pdf.getPage(pageNum);

      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport }).promise;

      setProgress(`OCR page ${pageNum}/${pdf.numPages}…`);
      const result = await Tesseract.recognize(canvas, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setProgress(
              `OCR page ${pageNum}/${pdf.numPages}… ${(m.progress * 100).toFixed(0)}%`
            );
          }
        },
      });

      text += "\n" + (result.data.text ?? "");
    }

    return text.trim();
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please upload a PDF file.");
      e.target.value = "";
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
      setError(err?.message ?? "Failed to process PDF");
    } finally {
      setBusy(false);
      e.target.value = "";
      setTimeout(() => setProgress(""), 2500);
    }
  }

  return (
    <Card title="Upload today’s sheet (PDF)">
      <div className="space-y-3">
        <input type="file" accept="application/pdf" onChange={onPick} disabled={busy} />

        {progress && <div className="text-sm text-zinc-700">{progress}</div>}
        {lastTextSize > 0 && (
          <div className="text-xs text-zinc-600">
            OCR text size: {lastTextSize} characters
          </div>
        )}
        {error && <div className="text-sm text-red-600">{error}</div>}

        <div className="text-xs text-zinc-600">
          Tip: If OCR misses a field, you can edit values manually before saving.
        </div>
      </div>
    </Card>
  );
}
