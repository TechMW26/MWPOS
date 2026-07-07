import { RoleShell } from "@/components/role-shell";

export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return <RoleShell>{children}</RoleShell>;
}
