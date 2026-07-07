'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield } from 'lucide-react';
import { useRealtimeList } from '@/lib/hooks/use-realtime-list';

const actionLabels: Record<string, string> = {
  USER_CREATED: 'User Created', USER_UPDATED: 'User Updated', STORE_CREATED: 'Store Created',
  STORE_UPDATED: 'Store Updated', PRODUCT_CREATED: 'Product Created', PRODUCT_UPDATED: 'Product Updated',
  INVENTORY_MOVEMENT: 'Inventory Move', ORDER_CREATED: 'Order Created', ORDER_STATUS_CHANGE: 'Order Status',
  SALE_COMPLETED: 'Sale', RETURN_PROCESSED: 'Return', PAYMENT_RECORDED: 'Payment',
  ROLE_CHANGED: 'Role Change', APPROVAL_CHANGED: 'Approval', SETTINGS_CHANGED: 'Settings',
};

export default function AuditLogsPage() {
  const [filter, setFilter] = useState('');
  const { data: logs, loading, error, live } = useRealtimeList({ path: 'auditLogs', fallbackUrl: '/api/audit-logs?limit=500' });

  const filtered = filter
    ? logs.filter(l => l.action?.toLowerCase().includes(filter.toLowerCase()) || l.entityType?.toLowerCase().includes(filter.toLowerCase()))
    : logs;

  return (
    <div className="space-y-6">
      <div className="flex gap-4 items-center">
        <input
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm w-full sm:w-64"
          placeholder="Filter by action or entity..."
          value={filter} onChange={e => setFilter(e.target.value)}
        />
        <span className="text-sm text-muted-foreground">{filtered.length} of {logs.length} entries</span>
        <span className="text-sm text-muted-foreground">{live ? 'Live updates on' : 'Auto refresh on'}</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Loading audit trail...</span>
        </div>
      ) : error ? (
        <Card className="border-destructive"><CardContent className="py-8 text-center">
          <p className="text-destructive font-medium">{error}</p>
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">No audit logs yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            {logs.length === 0
              ? 'Audit entries appear automatically when users perform actions like creating stores, changing roles, or processing orders.'
              : 'No entries match your filter.'}
          </p>
        </CardContent></Card>
      ) : (
        <Card><CardHeader><CardTitle>Activity Log ({filtered.length})</CardTitle></CardHeader><CardContent>
          <DataTable data={filtered} columns={[
            { key: 'action', header: 'Action', render: (l) => (
              <Badge variant="outline" className="font-mono text-xs">{actionLabels[l.action] || l.action}</Badge>
            )},
            { key: 'entityType', header: 'Entity', render: (l) => <span className="text-sm">{l.entityType}</span> },
            { key: 'entityId', header: 'Entity ID', render: (l) => <span className="font-mono text-xs">{String(l.entityId || '').slice(0, 12)}...</span> },
            { key: 'actorId', header: 'Actor', render: (l) => <span className="font-mono text-xs">{String(l.actorId || '').slice(0, 8)}...</span> },
            { key: 'createdAt', header: 'Timestamp', render: (l) => new Date(l.createdAt).toLocaleString() },
          ]} />
        </CardContent></Card>
      )}
    </div>
  );
}
