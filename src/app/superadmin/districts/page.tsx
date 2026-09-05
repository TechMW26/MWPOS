"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  MapPinIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlusIcon,
  PowerIcon,
  SpinnerGapIcon,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { StatCard } from "@/components/ui/stat-card";
import { INDIAN_STATES, getDistrictsForState } from "@/lib/indian-districts";
import type { District } from "@/types/models";

interface DistrictRow extends District {
  [key: string]: unknown;
}

interface DistrictForm {
  name: string;
  city: string;
  state: string;
}

const emptyForm: DistrictForm = { name: "", city: "", state: "" };

function readableDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN");
}

export default function DistrictsPage() {
  const [districts, setDistricts] = useState<DistrictRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DistrictRow | null>(null);
  const [form, setForm] = useState<DistrictForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadDistricts = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/districts?includeInactive=1", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "Unable to load districts");
      setDistricts(Array.isArray(data) ? data : []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load districts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDistricts();
  }, [loadDistricts]);

  const filteredDistricts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("en-IN");
    return districts.filter((district) => {
      if (status === "ACTIVE" && !district.isActive) return false;
      if (status === "INACTIVE" && district.isActive) return false;
      if (!normalizedQuery) return true;
      return [district.name, district.city, district.state]
        .some((value) => value.toLocaleLowerCase("en-IN").includes(normalizedQuery));
    });
  }, [districts, query, status]);

  const stateCount = useMemo(() => new Set(districts.map((district) => district.state)).size, [districts]);
  const districtOptions = useMemo(() => getDistrictsForState(form.state), [form.state]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(district: DistrictRow) {
    setEditing(district);
    setForm({ name: district.name, city: district.city, state: district.state });
    setFormError("");
    setModalOpen(true);
  }

  async function saveDistrict(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch("/api/districts", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...form } : form),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "Unable to save district");
      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await loadDistricts();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save district");
    } finally {
      setSaving(false);
    }
  }

  async function toggleDistrict(district: DistrictRow) {
    setUpdatingId(district.id);
    setLoadError("");
    try {
      const response = await fetch("/api/districts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: district.id, isActive: !district.isActive }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.message || "Unable to update district");
      setDistricts((current) => current.map((item) => item.id === district.id ? data : item));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to update district");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground">Manage the territories used for ASM and distributor assignment.</p>
        <Button type="button" className="w-full sm:w-auto" onClick={openCreate}>
          <PlusIcon className="mr-2 h-4 w-4" weight="bold" />Add district
        </Button>
      </div>

      {loadError && (
        <div className="flex flex-col gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
          <span>{loadError}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadDistricts()}>Try again</Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Districts" value={districts.length} icon={<MapPinIcon className="h-5 w-5" />} />
        <StatCard title="Active" value={districts.filter((district) => district.isActive).length} icon={<PowerIcon className="h-5 w-5" />} />
        <StatCard title="States covered" value={stateCount} icon={<MapPinIcon className="h-5 w-5" />} />
      </div>

      <Card>
        <CardHeader className="gap-4">
          <CardTitle>Configured districts</CardTitle>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <label className="relative block">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-10"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search district, city or state"
                aria-label="Search districts"
              />
            </label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              aria-label="Filter by status"
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active only</option>
              <option value="INACTIVE">Inactive only</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
              <SpinnerGapIcon className="h-5 w-5 animate-spin" />Loading districts…
            </div>
          ) : (
            <DataTable
              data={filteredDistricts}
              emptyMessage={query || status !== "ALL" ? "No districts match these filters." : "No districts configured yet."}
              columns={[
                { key: "name", header: "District" },
                { key: "city", header: "City" },
                { key: "state", header: "State" },
                {
                  key: "isActive",
                  header: "Status",
                  render: (district) => (
                    <Badge variant={district.isActive ? "success" : "secondary"}>
                      {district.isActive ? "Active" : "Inactive"}
                    </Badge>
                  ),
                },
                { key: "updatedAt", header: "Updated", render: (district) => readableDate(district.updatedAt) },
                {
                  key: "actions",
                  header: "Actions",
                  render: (district) => (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => openEdit(district)}>
                        <PencilSimpleIcon className="mr-1.5 h-4 w-4" />Edit
                      </Button>
                      <Button
                        type="button"
                        variant={district.isActive ? "outline" : "default"}
                        size="sm"
                        disabled={updatingId === district.id}
                        onClick={() => void toggleDistrict(district)}
                      >
                        {updatingId === district.id
                          ? <SpinnerGapIcon className="mr-1.5 h-4 w-4 animate-spin" />
                          : <PowerIcon className="mr-1.5 h-4 w-4" />}
                        {district.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
          )}
        </CardContent>
      </Card>

      <Modal
        open={modalOpen}
        title={editing ? "Edit district" : "Add district"}
        onClose={() => { if (!saving) setModalOpen(false); }}
        className="max-w-2xl"
      >
        <form className="space-y-5" onSubmit={saveDistrict}>
          {formError && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{formError}</div>
          )}
          <div>
            <label className="mb-1.5 block text-sm font-medium" htmlFor="district-state">State</label>
            <select
              id="district-state"
              autoFocus
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.state}
              onChange={(event) => setForm({ state: event.target.value, name: "", city: "" })}
              required
            >
              <option value="">Select state</option>
              {INDIAN_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="district-name">District</label>
              <select
                id="district-name"
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value, city: current.city || event.target.value }))}
                disabled={!form.state}
                required
              >
                <option value="">{form.state ? "Select district" : "Select state first"}</option>
                {editing && form.name && !districtOptions.includes(form.name) && <option value={form.name}>{form.name}</option>}
                {districtOptions.map((district) => <option key={district} value={district}>{district}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium" htmlFor="district-city">City</label>
              <Input
                id="district-city"
                value={form.city}
                onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
                placeholder="Administrative city"
                disabled={!form.name}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" disabled={saving} onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !form.state || !form.name || !form.city}>
              {saving && <SpinnerGapIcon className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? "Saving…" : editing ? "Save changes" : "Add district"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
