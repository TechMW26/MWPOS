import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";

export function MetricBarChart({
  title,
  data,
}: {
  title: string;
  data: Array<{ label: string; value: number; tone?: string }>;
}) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {data.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium">{item.value.toLocaleString()}</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className={cn("h-2 rounded-full bg-primary transition-all duration-500 ease-out", item.tone)}
                style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function DistributionDonut({
  title,
  data,
}: {
  title: string;
  data: Array<{ label: string; value: number; color: string }>;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const gradient = data.map((item) => {
    const start = total ? (cursor / total) * 100 : 0;
    cursor += item.value;
    const end = total ? (cursor / total) * 100 : 0;
    return `${item.color} ${start}% ${end}%`;
  }).join(", ");

  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="flex items-center gap-4">
        <div
          className="h-24 w-24 shrink-0 rounded-full border transition-all duration-500 sm:h-28 sm:w-28"
          style={{ background: total ? `conic-gradient(${gradient})` : "hsl(var(--muted))" }}
        />
        <div className="min-w-0 space-y-2">
          {data.map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
              <span className="truncate text-muted-foreground">{item.label}</span>
              <span className="font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function MiniTrend({
  title,
  data,
}: {
  title: string;
  data: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="flex h-28 items-end gap-2 sm:h-36">
          {data.map((item) => (
            <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="w-full rounded-t-md bg-primary/80 transition-all duration-500 ease-out" style={{ height: `${Math.max(6, (item.value / max) * 120)}px` }} />
              <span className="max-w-full truncate text-[10px] text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
