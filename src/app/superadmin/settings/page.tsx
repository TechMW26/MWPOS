'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, CreditCard, Bell, ShieldCheck, SlidersHorizontal } from 'lucide-react';

const defaults = {
  businessName: 'MW-POS',
  supportEmail: '',
  defaultPaymentMode: 'PAY_LATER',
  lowStockThreshold: 10,
  requireOwnerOtp: true,
  allowManagerOwnerApproval: true,
  notifyOwnersOnOrder: true,
  notifyManagersOnLowStock: true,
  autoApproveManagers: false,
  razorpay: { enabled: false, keyId: '', webhookSecret: '', mode: 'test' },
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      setSettings({ ...defaults, ...d, razorpay: { ...defaults.razorpay, ...(d.razorpay ?? {}) } });
      setLoading(false);
    });
  }, []);

  async function save() {
    setSaving(true);
    await fetch('/api/settings', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(settings) });
    setSaving(false);
  }

  function update(key: string, value: any) {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
  }

  function updateRazorpay(key: string, value: any) {
    setSettings((prev: any) => ({ ...prev, razorpay: { ...prev.razorpay, [key]: value } }));
  }

  if (loading) return <div className="text-muted-foreground">Loading...</div>;
  const razorpay = settings.razorpay ?? defaults.razorpay;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5" />Business Controls</CardTitle>
            <CardDescription>Set the defaults users see while ordering and managing stores.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Business name" help="Shown in app headers and customer flows.">
              <Input placeholder="MW-POS" value={settings.businessName} onChange={e => update('businessName', e.target.value)} />
            </Field>
            <Field label="Support email" help="Used in customer-facing help text.">
              <Input type="email" placeholder="support@example.com" value={settings.supportEmail} onChange={e => update('supportEmail', e.target.value)} />
            </Field>
            <Field label="Default payment" help="Preselects checkout payment mode.">
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={settings.defaultPaymentMode} onChange={e => update('defaultPaymentMode', e.target.value)}>
                <option value="PAY_LATER">Khata / pay later</option>
                <option value="UPFRONT">Pay upfront</option>
              </select>
            </Field>
            <Field label="Low stock threshold" help="Default reorder alert point for inventory.">
              <Input type="number" min={0} placeholder="10" value={settings.lowStockThreshold} onChange={e => update('lowStockThreshold', Number(e.target.value || 0))} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Approval Rules</CardTitle>
            <CardDescription>Control manager ordering and owner confirmation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Toggle label="Require owner OTP for manager orders" checked={settings.requireOwnerOtp} onChange={v => update('requireOwnerOtp', v)} />
            <Toggle label="Allow app approval from store owner" checked={settings.allowManagerOwnerApproval} onChange={v => update('allowManagerOwnerApproval', v)} />
            <Toggle label="Auto-approve new store managers" checked={settings.autoApproveManagers} onChange={v => update('autoApproveManagers', v)} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Notifications</CardTitle>
            <CardDescription>Keep owners and managers informed at the right moments.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Toggle label="Notify owners when approval is needed" checked={settings.notifyOwnersOnOrder} onChange={v => update('notifyOwnersOnOrder', v)} />
            <Toggle label="Notify managers when stock is low" checked={settings.notifyManagersOnLowStock} onChange={v => update('notifyManagersOnLowStock', v)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />Razorpay</CardTitle>
            <CardDescription>Enable upfront payment collection while keeping Khata separate.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Toggle label="Accept upfront Razorpay payments" checked={Boolean(razorpay.enabled)} onChange={v => updateRazorpay('enabled', v)} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Key ID" help="Public key ID, for example rzp_live_...">
                <Input placeholder="rzp_live_..." value={razorpay.keyId ?? ''} onChange={e => updateRazorpay('keyId', e.target.value)} />
              </Field>
              <Field label="Webhook secret" help="Used to verify Razorpay callbacks.">
                <Input placeholder="Webhook signing secret" value={razorpay.webhookSecret ?? ''} onChange={e => updateRazorpay('webhookSecret', e.target.value)} />
              </Field>
              <Field label="Mode" help="Use test until live keys are ready.">
                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={razorpay.mode ?? 'test'} onChange={e => updateRazorpay('mode', e.target.value)}>
                  <option value="test">Test mode</option>
                  <option value="live">Live mode</option>
                </select>
              </Field>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-20 z-10 -mx-3 bg-background/95 px-3 py-2 backdrop-blur sm:mx-0 sm:flex sm:justify-end sm:bg-transparent sm:px-0 lg:bottom-4">
        <Button className="w-full sm:w-auto" onClick={save} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? 'Saving...' : 'Save settings'}</Button>
      </div>
    </div>
  );
}

function Field({ label, help, children }: { label: string; help: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      {children}
      <span className="block text-xs text-muted-foreground">{help}</span>
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-4 border-b py-3 text-sm last:border-b-0">
      <span className="font-medium">{label}</span>
      <input className="h-5 w-5 accent-primary" type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
    </label>
  );
}
