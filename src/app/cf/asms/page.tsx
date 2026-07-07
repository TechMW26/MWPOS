'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

export default function CfAsmsPage() {
  const [asms, setAsms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const sessionRes = await fetch('/api/auth/session');
        const sessionData = await sessionRes.json();
        const uid = sessionData?.user?.uid || sessionData?.uid;
        const usersRes = await fetch('/api/users?role=ASM');
        const users = await usersRes.json();
        setAsms(Array.isArray(users) ? users.filter((user: any) => user.cfId === uid) : []);
      } catch {
        setAsms([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading ASMs...</div>;

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">Area Sales Managers assigned to your C&amp;F account.</p>

      <Card>
        <CardHeader><CardTitle>Assigned ASMs ({asms.length})</CardTitle></CardHeader>
        <CardContent>
          <DataTable data={asms} columns={[
            { key: 'displayName', header: 'Name' },
            { key: 'email', header: 'Email/Phone', render: asm => asm.email || asm.phone || '-' },
            { key: 'districtId', header: 'District', render: asm => asm.districtId || '-' },
            { key: 'approvalStatus', header: 'Approval', render: asm => asm.approvalStatus ? <Badge variant={asm.approvalStatus === 'APPROVED' ? 'success' : asm.approvalStatus === 'REJECTED' ? 'destructive' : 'warning'}>{asm.approvalStatus}</Badge> : '-' },
            { key: 'isActive', header: 'Active', render: asm => <Badge variant={asm.isActive ? 'success' : 'destructive'}>{asm.isActive ? 'Yes' : 'No'}</Badge> },
          ]} emptyMessage="No ASMs assigned to you yet." />
        </CardContent>
      </Card>
    </div>
  );
}
