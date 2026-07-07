import { RoleShell } from "@/components/role-shell";

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell>{children}</RoleShell>;
}
