"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2, MapPin, Phone, Plus, Search, Store, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Select } from "@/components/ui/select";
import { INDIAN_STATES, getDistrictsForState } from "@/lib/indian-districts";
import type { Distributor } from "@/types/models";

const emptyForm = {
  name: "",
  phone: "",
  phoneCode: "+91",
  gstin: "",
  state: "",
  district: "",
  city: "",
  ward: "",
  address: "",
  pincode: "",
  ownerName: "",
  ownerPhone: "",
  ownerPhoneCode: "+91",
};

export default function AsmDistributorsPage() {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [assignedDistrictId, setAssignedDistrictId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [wardOptions, setWardOptions] = useState<string[]>([]);
  const [wardsLoading, setWardsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const districtsForState = useMemo(() => getDistrictsForState(form.state), [form.state]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return distributors.filter((item) => !query || `${item.name} ${item.city} ${item.phone}`.toLowerCase().includes(query));
  }, [distributors, search]);

  async function load() {
    const [distributorsResponse, sessionResponse] = await Promise.all([
      fetch("/api/distributors", { cache: "no-store" }),
      fetch("/api/auth/session", { cache: "no-store" }),
    ]);
    const [list, session] = await Promise.all([distributorsResponse.json(), sessionResponse.json()]);
    setDistributors(Array.isArray(list) ? list : []);
    setAssignedDistrictId(session?.user?.districtId || "");
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
    if (new URLSearchParams(window.location.search).get("add") === "1") setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) setOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, saving]);

  useEffect(() => {
    if (!form.state || !form.city) {
      setWardOptions([]);
      setWardsLoading(false);
      return;
    }
    const controller = new AbortController();
    setWardsLoading(true);
    fetch(`/api/geo/areas?state=${encodeURIComponent(form.state)}&city=${encodeURIComponent(form.city)}`, {
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : [])
      .then((areas) => setWardOptions(Array.isArray(areas) ? areas : []))
      .catch((error) => {
        if (error instanceof Error && error.name !== "AbortError") setWardOptions([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setWardsLoading(false);
      });
    return () => controller.abort();
  }, [form.state, form.city]);

  function closeForm() {
    if (saving) return;
    setMessage("");
    setOpen(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const districtId = `${form.state}|${form.district}|${form.city}|${form.ward}`;
    try {
      const response = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          type: "DISTRIBUTOR",
          districtId,
          address: form.address,
          city: form.city,
          state: form.state,
          pincode: form.pincode,
          phone: `${form.phoneCode} ${form.phone}`,
          gstin: form.gstin || null,
          ownerName: form.ownerName || null,
          ownerPhone: form.ownerPhone ? `${form.ownerPhoneCode} ${form.ownerPhone}` : null,
          ownerEmail: null,
          email: null,
          logoUrl: null,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const fieldErrors = payload?.errors?.fieldErrors
          ? Object.entries(payload.errors.fieldErrors)
              .flatMap(([field, errors]) => (errors as string[]).map((error) => `${field}: ${error}`))
              .join(", ")
          : "";
        throw new Error(fieldErrors || payload?.message || "Unable to add distributor.");
      }
      setForm(emptyForm);
      setOpen(false);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add distributor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 px-1">
        <div>
          <h2 className="text-xl font-bold">My distributors</h2>
          <p className="text-sm text-muted-foreground">Add clients and place their orders</p>
        </div>
        <Button onClick={() => setOpen(true)} className="rounded-full">
          <Plus className="mr-1.5 h-4 w-4" />Add
        </Button>
      </div>

      <label className="flex h-12 items-center gap-2 rounded-2xl border bg-white px-4 transition-shadow focus-within:ring-2 focus-within:ring-primary/25">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          placeholder="Search name, city or phone"
          aria-label="Search distributors"
        />
      </label>

      {loading ? (
        <div className="flex min-h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading distributors
        </div>
      ) : filtered.length === 0 ? (
        <div className="animate-in rounded-[1.5rem] border bg-white p-10 text-center">
          <Store className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="font-bold">No distributors found</p>
          <Button className="mt-4" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />Add first distributor
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item, index) => (
            <div
              key={item.id}
              className="animate-in rounded-[1.45rem] border bg-white p-4 shadow-sm"
              style={{ animationDelay: `${Math.min(index, 6) * 35}ms` }}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 font-bold text-blue-700">
                  {item.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{item.name}</p>
                  <p className="mt-0.5 flex items-center text-xs text-muted-foreground">
                    <MapPin className="mr-1 h-3.5 w-3.5" />{item.city}, {item.state}
                  </p>
                </div>
                <Badge variant={item.approvalStatus === "APPROVED" ? "success" : "warning"}>
                  {item.approvalStatus === "APPROVED" ? "Active" : "Pending"}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a href={`tel:${item.phone}`} className="flex h-11 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold transition active:scale-[0.98]">
                  <Phone className="mr-1.5 h-4 w-4" />Call
                </a>
                <Link href={`/asm/pos?distributor=${item.id}`} className="flex h-11 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition active:scale-[0.98]">
                  Place order <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex animate-overlay items-end bg-slate-950/45 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm();
          }}
        >
          <form
            onSubmit={submit}
            className="mx-auto max-h-[94dvh] w-full max-w-[520px] animate-sheet-up overflow-y-auto overscroll-contain rounded-t-[2rem] bg-white px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-distributor-title"
          >
            <div className="sticky top-0 z-10 -mx-5 mb-5 bg-white/95 px-5 pb-3 backdrop-blur-xl">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 id="add-distributor-title" className="text-xl font-bold">Add distributor</h3>
                  <p className="text-sm text-muted-foreground">Admin approval is required before ordering.</p>
                </div>
                <button type="button" onClick={closeForm} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 transition active:scale-95" aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="grid gap-4">
              <Field label="Distributor name" required>
                <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} minLength={2} required placeholder="Business name" autoFocus />
              </Field>
              <Field label="Distributor phone" required>
                <PhoneInput value={form.phone} countryCode={form.phoneCode} onChange={(phone, phoneCode) => setForm({ ...form, phone, phoneCode })} required />
              </Field>
              <Field label="GSTIN">
                <Input value={form.gstin} onChange={(event) => setForm({ ...form, gstin: event.target.value.toUpperCase() })} placeholder="Optional" autoCapitalize="characters" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="State" required>
                  <Select value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value, district: "", city: "", ward: "" })} required>
                    <option value="">Select state</option>
                    {INDIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
                  </Select>
                </Field>
                <Field label="District" required>
                  <Select value={form.district} onChange={(event) => setForm({ ...form, district: event.target.value, city: "", ward: "" })} required disabled={!form.state}>
                    <option value="">{form.state ? "Select district" : "Select state first"}</option>
                    {districtsForState.map((district) => <option key={district} value={district}>{district}</option>)}
                  </Select>
                </Field>
                <Field label="City" required>
                  <Select value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value, ward: "" })} required disabled={!form.district}>
                    <option value="">{form.district ? "Select city" : "Select district first"}</option>
                    {districtsForState.map((city) => <option key={city} value={city}>{city}</option>)}
                  </Select>
                </Field>
                <Field label="Ward / Area" required>
                  <Select value={form.ward} onChange={(event) => setForm({ ...form, ward: event.target.value })} required disabled={!form.city || wardsLoading}>
                    <option value="">{wardsLoading ? "Loading areas…" : form.city ? "Select ward" : "Select city first"}</option>
                    {wardOptions.map((ward) => <option key={ward} value={ward}>{ward}</option>)}
                  </Select>
                </Field>
              </div>

              <Field label="Address" required>
                <Input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} minLength={5} required placeholder="Street and locality" />
              </Field>
              <Field label="Pincode" required>
                <Input value={form.pincode} onChange={(event) => setForm({ ...form, pincode: event.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" minLength={6} maxLength={6} required placeholder="6-digit pincode" />
              </Field>

              <div className="border-t pt-4">
                <p className="mb-3 text-sm font-bold">Owner details <span className="font-normal text-muted-foreground">(for OTP login)</span></p>
                <div className="grid gap-4">
                  <Field label="Owner name">
                    <Input value={form.ownerName} onChange={(event) => setForm({ ...form, ownerName: event.target.value })} placeholder="Optional" />
                  </Field>
                  <Field label="Owner phone">
                    <PhoneInput value={form.ownerPhone} countryCode={form.ownerPhoneCode} onChange={(ownerPhone, ownerPhoneCode) => setForm({ ...form, ownerPhone, ownerPhoneCode })} />
                  </Field>
                </div>
              </div>

              {message && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</p>}
              <Button type="submit" size="lg" className="sticky bottom-0 w-full rounded-2xl shadow-lg" disabled={saving || !assignedDistrictId || wardsLoading}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                {saving ? "Adding…" : "Add distributor"}
              </Button>
              {!assignedDistrictId && <p className="text-center text-xs text-red-600">Your ASM account needs an assigned district.</p>}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold">
      <span>{label}{required && <span className="text-red-500"> *</span>}</span>
      {children}
    </label>
  );
}
