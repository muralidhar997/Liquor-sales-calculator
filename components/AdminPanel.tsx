"use client";

import { useEffect, useState } from "react";
import { Button, Card, FieldRow, Input, Select } from "./ui";

type Store = { id: string; name: string };
type UserCode = { id: string; store_id: string; code4: string; is_active: boolean; store_name: string };

export default function AdminPanel() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [stores, setStores] = useState<Store[]>([]);
  const [codes, setCodes] = useState<UserCode[]>([]);
  const [storeName, setStoreName] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  const [code4, setCode4] = useState("");

  async function load() {
    const res = await fetch("/api/admin/list");
    if (!res.ok) return;
    const data = await res.json();
    setStores(data.stores);
    setCodes(data.codes);
    if (!selectedStore && data.stores?.[0]?.id) setSelectedStore(data.stores[0].id);
  }

  async function loginAdmin() {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password })
    });
    if (!res.ok) {
      alert("Wrong password");
      return;
    }
    setAuthed(true);
    await load();
  }

  async function createStore() {
    const name = storeName.trim();
    if (!name) return;
    const res = await fetch("/api/admin/create-store", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (!res.ok) return alert(data?.error ?? "Failed");
    setStoreName("");
    await load();
  }

  async function createCode() {
    if (!/^\d{4}$/.test(code4)) return alert("Code must be 4 digits");
    if (!selectedStore) return alert("Select a store");
    const res = await fetch("/api/admin/create-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ storeId: selectedStore, code4 })
    });
    const data = await res.json();
    if (!res.ok) return alert(data?.error ?? "Failed");
    setCode4("");
    await load();
  }

  async function rotateCode(storeId: string) {
    const res = await fetch("/api/admin/rotate-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ storeId })
    });
    const data = await res.json();
    if (!res.ok) return alert(data?.error ?? "Failed");
    await load();
  }

  async function toggleActive(codeId: string, is_active: boolean) {
    const res = await fetch("/api/admin/toggle-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ codeId, is_active: !is_active })
    });
    const data = await res.json();
    if (!res.ok) return alert(data?.error ?? "Failed");
    await load();
  }

  useEffect(() => {
    // If already logged in (cookie), list works
    (async () => {
      const res = await fetch("/api/admin/list");
      if (res.ok) {
        setAuthed(true);
        const data = await res.json();
        setStores(data.stores);
        setCodes(data.codes);
        if (data.stores?.[0]?.id) setSelectedStore(data.stores[0].id);
      }
    })();
  }, []);

  if (!authed) {
    return (
      <div className="grid place-items-center">
        <div className="w-full max-w-md">
          <Card title="Admin Login">
            <div className="space-y-3">
              <Input label="Admin password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
              <Button onClick={loginAdmin}>Login</Button>
              <div className="text-xs text-zinc-600">
                Set password in <code>ADMIN_PASSWORD</code>.
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card title="Create Store">
        <div className="flex gap-2">
          <Input value={storeName} onChange={e=>setStoreName(e.target.value)} placeholder="Store name (e.g. Downtown Liquors)" />
          <Button onClick={createStore}>Create</Button>
        </div>
      </Card>

      <Card title="Create 4-digit User Code linked to Store">
        <div className="space-y-3">
          <FieldRow>
            <Select label="Store" value={selectedStore} onChange={e=>setSelectedStore(e.target.value)}>
              {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Input
              label="4-digit code"
              inputMode="numeric"
              maxLength={4}
              value={code4}
              onChange={(e)=>setCode4(e.target.value.replace(/\D/g, "").slice(0,4))}
              placeholder="1234"
            />
          </FieldRow>
          <Button onClick={createCode}>Create code</Button>
          <div className="text-xs text-zinc-600">
            Extra options included: Rotate code & Disable code.
          </div>
        </div>
      </Card>

      <Card title="Existing Codes">
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white sticky top-0">
              <tr className="text-left border-b border-zinc-200">
                <th className="py-2 pr-3">Store</th>
                <th className="py-2 pr-3">Code</th>
                <th className="py-2 pr-3">Active</th>
                <th className="py-2 pr-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {codes.map(c => (
                <tr key={c.id} className="border-b border-zinc-100">
                  <td className="py-2 pr-3">{c.store_name}</td>
                  <td className="py-2 pr-3 font-mono">{c.code4}</td>
                  <td className="py-2 pr-3">{c.is_active ? "Yes" : "No"}</td>
                  <td className="py-2 pr-3 flex flex-wrap gap-2">
                    <Button variant="ghost" onClick={() => toggleActive(c.id, c.is_active)}>
                      {c.is_active ? "Disable" : "Enable"}
                    </Button>
                    <Button variant="ghost" onClick={() => rotateCode(c.store_id)}>
                      Rotate code
                    </Button>
                  </td>
                </tr>
              ))}
              {!codes.length ? (
                <tr><td className="py-3 text-zinc-600" colSpan={4}>No codes yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
