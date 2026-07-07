'use client';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

export default function AdminInventoryPage() {
  const [distributors, setDistributors] = useState<any[]>([]);
  const [selectedDistributor, setSelectedDistributor] = useState('');
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMovement, setShowMovement] = useState(false);
  const [movForm, setMovForm] = useState({ skuId:'', quantity:0, movementType:'ADJUSTMENT', referenceType:'MANUAL', referenceId:'', notes:'' });

  useEffect(() => {
    fetch('/api/distributors').then(r => r.json()).then(d => {
      const list = Array.isArray(d) ? d : [];
      setDistributors(list);
      if (list.length > 0) setSelectedDistributor(list[0].id);
      setLoading(list.length === 0 ? false : true);
    });
  }, []);
  useEffect(() => {
    if (!selectedDistributor) return; setLoading(true);
    fetch('/api/inventory?storeId='+selectedDistributor).then(r => r.json()).then(d => { setInventory(Array.isArray(d) ? d : []); setLoading(false); });
  }, [selectedDistributor]);

  if (distributors.length === 0 && !loading) {
    return (
      <div className="space-y-6">
        <Card className="p-4 text-center"><p className="text-muted-foreground">No distributors found. Create distributors first from the Distributors page.</p></Card>
      </div>
    );
  }

  async function handleMovement(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/inventory/movement', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ ...movForm, storeId: selectedDistributor, idempotencyKey: crypto.randomUUID() }) });
    setShowMovement(false);
    const res = await fetch('/api/inventory?storeId='+selectedDistributor); const data = await res.json(); setInventory(Array.isArray(data) ? data : []);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button className="w-full sm:w-auto" onClick={() => setShowMovement(true)}>Stock Movement</Button>
      </div>
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium">Distributor:</label>
        <select className="flex h-10 rounded-md border px-3 py-2 text-sm w-full sm:w-64" value={selectedDistributor} onChange={e => setSelectedDistributor(e.target.value)}>
          {distributors.map(d => <option key={d.id} value={d.id}>{d.name} ({d.city})</option>)}
        </select>
      </div>
      <Modal open={showMovement} title="Stock Movement" onClose={() => setShowMovement(false)}>
          <form onSubmit={handleMovement} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input placeholder="SKU ID" value={movForm.skuId} onChange={e => setMovForm({...movForm, skuId:e.target.value})} required />
            <Input type="number" placeholder="Quantity (+ in, - out)" value={movForm.quantity} onChange={e => setMovForm({...movForm, quantity:Number(e.target.value)})} required />
            <select className="flex h-10 rounded-md border px-3 py-2 text-sm" value={movForm.movementType} onChange={e => setMovForm({...movForm, movementType:e.target.value})}>
              <option value="ADJUSTMENT">Adjustment</option><option value="INITIAL">Initial Stock</option><option value="PURCHASE">Purchase</option><option value="WASTAGE">Wastage</option>
            </select>
            <Input placeholder="Reference ID" value={movForm.referenceId} onChange={e => setMovForm({...movForm, referenceId:e.target.value})} />
            <Input placeholder="Notes" className="sm:col-span-2" value={movForm.notes} onChange={e => setMovForm({...movForm, notes:e.target.value})} />
            <div className="sm:col-span-2"><Button className="w-full sm:w-auto" type="submit">Record Movement</Button></div>
          </form>
      </Modal>
      {loading ? <p className="text-muted-foreground">Loading...</p> : (
        <Card><CardHeader><CardTitle>Stock Levels ({inventory.length})</CardTitle></CardHeader><CardContent>
          <DataTable data={inventory} columns={[
            { key: 'skuId', header: 'SKU ID' }, { key: 'onHand', header: 'On Hand' }, { key: 'reserved', header: 'Reserved' }, { key: 'available', header: 'Available' },
            { key: 'status', header: 'Status', render: (i) => i.available <= (i.reorderThreshold||10) ? <Badge variant="destructive">Low</Badge> : <Badge variant="success">OK</Badge> },
          ]} />
        </CardContent></Card>
      )}
    </div>
  );
}
