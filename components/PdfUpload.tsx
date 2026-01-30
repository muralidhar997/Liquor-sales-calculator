"use client";

import { useState } from "react";
import { Button, Card } from "./ui";
import { parseDailySheetText, type ParsedAudit } from "../lib/parseDailySheet";

import * as pdfjs from "pdfjs-dist";
import Tesseract from "tesseract.js";

import { createClient } from "@supabase/supabase-js";

// NOTE: use your env vars (set in Vercel too)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ✅ Must match your installed version (you said you want 4.4.168)
// and avoid CDN mismatch
(pdfjs as any).GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type Props = {
  storeId: string; // pass storeId from dashboard/user context
  onParsed: (p: ParsedAudit) => void;
};

export default function PdfUpload({ storeId, onParsed }: Props) {
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

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      await page.render({ canvasContext: ctx, viewport }).promise;

      setProgress(`OCR page ${i}/${doc.numPages}…`);
      const { data } = await Tesseract.recognize(canvas, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setProgress(
              `OCR page ${i}/${doc.numPages}… ${(m.progress * 100).toFixed(0)}%`
            );
          }
        },
      });

      allText += "\n" + (data.text ?? "");
    }

    return allText.trim();
  }

  async function uploadPdfAndLog(file: File, parsed: ParsedAudit, textSize: number) {
    // file path: storeId/YYYY-MM-DD/filename.pdf
    const day = new Date().toISOString().slice(0, 10);
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const filePath = `${storeId}/${day}/${Date.now()}_${safeName}`;

    setProgress("Uploading PDF…");

    const { error: upErr } = await supabase.storage
      .from("audit-pdfs")
      .upload(filePath, file, {
        upsert: false,
        contentType: "application/pdf",
      });

    if (upErr) throw new Error(upErr.message);

    setProgress("Saving upload record…");

    const { error: dbErr } = await supabase.from("audit_uploads").insert({
      store_id: storeId,
      file_path: filePath,
      original_name: file.name,
      parsed_json: parsed,
      text_size: textSize,
    });

    if (dbErr) throw new Error(dbErr.message);
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

      setProgress("Parsing…");
      const parsed = parseDailySheetText(text);

      // ✅ Update UI immediately
      onParsed(parsed);

      // ✅ Store pdf + parsed info
      await uploadPdfAndLog(file, parsed, text.length);

      setProgress("Done. Summary updated + PDF saved.");
    } catch (err: any) {
      setError(err?.message ?? "Failed to OCR/parse/upload PDF");
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
        {progress ? <div className="text-sm text-zinc-700">{progress}</div> : null}
        {lastTextSize ? (
          <div className="text-xs text-zinc-600">OCR text size: {lastTextSize} chars</div>
        ) : null}
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        <div className="text-xs text-zinc-600">
          Tip: If OCR misses a field, you can edit values in the Summary before saving.
        </div>
      </div>
    </Card>
  );
}


