import { cn } from "@/lib/cn";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "destructive" | "outline";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
        {
          "bg-primary text-primary-foreground": variant === "default",
          "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100": variant === "success",
          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100": variant === "warning",
          "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100": variant === "destructive",
          "border border-input bg-background": variant === "outline",
        },
        className
      )}
    >
      {children}
    </span>
  );
}
