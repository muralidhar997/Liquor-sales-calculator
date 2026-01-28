"use client";

import { useState } from "react";
import { Button, Card, Input } from "./ui";
import { useRouter } from "next/navigation";

export default function LoginCard() {
  const [code4, setCode4] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit() {
    setErr(null);
    const v = code4.trim();
    if (!/^\d{4}$/.test(v)) {
      setErr("Enter a 4-digit code.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code4: v })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Login failed");
      router.push("/user");
    } catch (e: any) {
      setErr(e.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title="Store Login (4-digit code)">
      <div className="space-y-3">
        <Input
          label="4-digit code"
          inputMode="numeric"
          maxLength={4}
          value={code4}
          onChange={(e) => setCode4(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="e.g. 1234"
        />
        {err ? <div className="text-sm text-red-600">{err}</div> : null}
        <Button disabled={loading} onClick={onSubmit}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
        <div className="text-xs text-zinc-600">
          Admin? Go to <a className="underline" href="/admin">/admin</a>.
        </div>
      </div>
    </Card>
  );
}
