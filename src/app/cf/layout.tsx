import { RoleShell } from '@/components/role-shell'

export default function CfLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell>{children}</RoleShell>
}
