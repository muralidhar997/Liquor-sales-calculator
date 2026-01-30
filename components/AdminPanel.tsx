"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Card } from "./ui";
import type { FileObject } from "@supabase/storage-js";

type StoredPdf = {
  name: string; // YYYY-MM-DD.pdf
  date: string; // YYYY-MM-DD
  path: string; // storeId/name
};

function keepLast30(files: StoredPdf[]) {
  const sorted = [...files].sort((a, b) => (a.date < b.date ? 1 : -1));
  return sorted.slice(0, 30);
}

export default function AdminPanel() {
  const [storeId, setStoreId] = useState("");
  const [files, setFiles] = useState<StoredPdf[]>([]);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    setFiles([]);

    if (!/^\d{4}$/.test(storeId)) {
      setError("Enter a valid 4-digit storeId.");
      return;
    }

    const { data, error } = await supabase.storage.from("daily-sheets").list(storeId, {
      limit: 200,
      offset: 0,
      sortBy: { column: "name", order: "desc" },
    });

    if (error) {
      setError(error.message);
      return;
    }

    const mapped: StoredPdf[] = (data ?? [])
      .filter((x: FileObject) => (x.name ?? "").toLowerCase().endsWith(".pdf"))
      .map((x: FileObject) => {
        const name = x.name;
        const date = name.replace(/\.pdf$/i, "");
        return { name, date, path: `${storeId}/${name}` };
      })
      .filter((x: StoredPdf) => /^\d{4}-\d{2}-\d{2}$/.test(x.date));

    setFiles(keepLast30(mapped));
  }

  async function openPdf(path: string) {
    const { data, error } = await supabase.storage.from("daily-sheets").createSignedUrl(path, 60 * 20);
    if (error) {
      alert(error.message);
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Card title="Admin: PDF Storage (Last 30 days)">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <div className="text-xs text-zinc-600 mb-1">Store ID (4 digits)</div>
            <input
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="e.g. 1234"
            />
          </div>

          <button onClick={load} className="border rounded px-3 py-2 text-sm bg-zinc-900 text-white">
            Load
          </button>
        </div>

        {error ? <div className="text-sm text-red-600 mt-2">{error}</div> : null}
      </Card>

      <Card title="Files">
        {files.length === 0 ? (
          <div className="text-sm text-zinc-600">No files loaded.</div>
        ) : (
          <div className="space-y-2">
            {files.map((f) => (
              <div key={f.path} className="flex items-center justify-between">
                <div className="text-sm">{f.date}</div>
                <button className="text-sm underline" onClick={() => openPdf(f.path)}>
                  View
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
