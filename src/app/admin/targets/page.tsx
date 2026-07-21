"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

type Asm = { uid: string; displayName: string; phone?: string | null };
type Row = { id: string; asmUid: string; asmName: string; targetPaise: number; achievedPaise: number; progressPercent: number };
const monthNow = new Date().toISOString().slice(0, 7);

export default function AdminTargetsPage() {
  const [asms, setAsms] = useState<Asm[]>([]); const [rows, setRows] = useState<Row[]>([]); const [asmUid, setAsmUid] = useState(""); const [month, setMonth] = useState(monthNow); const [amount, setAmount] = useState(""); const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  async function load() { const [usersResponse, targetsResponse] = await Promise.all([fetch("/api/users?role=ASM"), fetch(`/api/targets?month=${month}`, { cache: "no-store" })]); const users = await usersResponse.json(); const targets = await targetsResponse.json(); const list = Array.isArray(users) ? users : []; setAsms(list); setAsmUid((current) => current || list[0]?.uid || ""); setRows(Array.isArray(targets.targets) ? targets.targets : []); }
  useEffect(() => { load().catch(() => setMessage("Unable to load targets.")); }, [month]);
  async function save() { setSaving(true); setMessage(""); const response = await fetch("/api/targets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asmUid, month, targetRupees: Number(amount) }) }); const payload = await response.json(); setSaving(false); if (!response.ok) return setMessage(payload.message || "Unable to save target."); setAmount(""); setMessage("Target saved and ASM notified."); await load(); }
  return <div className="space-y-5"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" />Assign monthly ASM target</CardTitle></CardHeader><CardContent className="grid gap-3 md:grid-cols-4"><select aria-label="ASM" value={asmUid} onChange={(event) => setAsmUid(event.target.value)} className="h-11 rounded-md border bg-background px-3 text-sm"><option value="">Select ASM</option>{asms.map((asm) => <option key={asm.uid} value={asm.uid}>{asm.displayName}{asm.phone ? ` · ${asm.phone}` : ""}</option>)}</select><Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} aria-label="Target month" /><Input type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Revenue target (₹)" /><Button onClick={save} disabled={saving || !asmUid || !amount}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save target</Button>{message && <p className="text-sm text-muted-foreground md:col-span-4">{message}</p>}</CardContent></Card><Card><CardHeader><CardTitle>{new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })} progress</CardTitle></CardHeader><CardContent className="space-y-3">{rows.length === 0 ? <p className="py-8 text-center text-muted-foreground">No targets assigned for this month.</p> : rows.map((row) => <div key={row.id} className="rounded-xl border p-4"><div className="flex justify-between gap-4"><div><p className="font-semibold">{row.asmName}</p><p className="text-sm text-muted-foreground">{formatCurrency(row.achievedPaise)} of {formatCurrency(row.targetPaise)}</p></div><span className="font-bold text-primary">{row.progressPercent}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${row.progressPercent}%` }} /></div></div>)}</CardContent></Card></div>;
}
