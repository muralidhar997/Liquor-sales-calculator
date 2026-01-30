"use client";

import { useMemo, useState } from "react";
import { Button, Card } from "./ui";
import { parseDailySheetText, type ParsedAudit } from "../lib/parseDailySheet";
import { supabase } from "../lib/supabase";
import * as pdfjs from "pdfjs-dist";
import Tesseract from "tesseract.js";

// ✅ lock worker to SAME version as pdfjs-dist
(pdfjs as any).GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

type Props = {
  storeId: string; // ✅ 4-digit id
  onParsed: (p: ParsedAudit, info: { date: string; uploadedPath?: string; localUrl?: string }) => void;
};

export default function PdfUpload({ storeId, onParsed }: Props) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState<string>(() => {
    // default today (local)
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [lastPreviewUrl, setLastPreviewUrl] = useState<string>("");

  const canUpload = useMemo(() => {
    return !!storeId && /^\d{4}$/.test(storeId) && !!date;
  }, [storeId, date]);

  async function ocrPdf(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    const doc = await (pdfjs as any).getDocument({ data: buf }).promise;

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

  async function uploadToSupabase(file: File, selectedDate: string) {
    // bucket: daily-sheets
    const path = `${storeId}/${selectedDate}.pdf`;

    // overwrite = true so re-upload same date replaces
    const { error: upErr } = await supabase.storage
      .from("daily-sheets")
      .upload(path, file, { upsert: true, contentType: "application/pdf" });

    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    return path;
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!/pdf$/i.test(file.name)) {
      setError("Please upload a PDF file.");
      return;
    }

    if (!canUpload) {
      setError("Please select a date (and make sure storeId is valid).");
      return;
    }

    setBusy(true);
    setProgress("Starting…");

    // local preview
    if (lastPreviewUrl) URL.revokeObjectURL(lastPreviewUrl);
    const localUrl = URL.createObjectURL(file);
    setLastPreviewUrl(localUrl);

    try {
      // 1) OCR
      const text = await ocrPdf(file);

      // 2) Parse
      const parsed = parseDailySheetText(text);

      // 3) Upload to storage
      setProgress("Uploading PDF to storage…");
      const uploadedPath = await uploadToSupabase(file, date);

      // 4) Send to dashboard
      onParsed(parsed, { date, uploadedPath, localUrl });

      setProgress("Done. Summary + Sales Amount updated.");
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
        {/* Date select */}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <div className="text-xs text-zinc-600 mb-1">Select date</div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={busy}
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>

          <div>
            <div className="text-xs text-zinc-600 mb-1">Store</div>
            <div className="border rounded px-2 py-1 text-sm bg-zinc-50 min-w-[90px] text-center">
              {storeId}
            </div>
          </div>
        </div>

        <input type="file" accept="application/pdf" onChange={onPick} disabled={busy || !canUpload} />

        {progress ? <div className="text-sm text-zinc-700">{progress}</div> : null}
        {error ? <div className="text-sm text-red-600">{error}</div> : null}

        <div className="text-xs text-zinc-600">
          Tip: If OCR misses something, you can still type values manually (we can also add manual overrides next).
        </div>

        {/* Preview */}
        {lastPreviewUrl ? (
          <div className="pt-2">
            <div className="text-xs text-zinc-600 mb-2">Preview (latest selected PDF)</div>
            <div className="border rounded overflow-hidden">
              <iframe src={lastPreviewUrl} className="w-full h-[420px]" />
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}


