import { cn } from "@/lib/cn";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function StatCard({ title, value, description, icon, trend, className }: StatCardProps) {
  return (
    <div className={cn("rounded-lg border bg-card p-3 shadow-sm animate-in hover-lift sm:p-4", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <p className="mt-2 text-xl font-bold tracking-tight sm:text-3xl">{value}</p>
      {description && (
        <p className={cn("mt-1 text-xs", {
          "text-green-600": trend === "up",
          "text-red-600": trend === "down",
          "text-muted-foreground": trend === "neutral" || !trend,
        })}>
          {description}
        </p>
      )}
    </div>
  );
}
