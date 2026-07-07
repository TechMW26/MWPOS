'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { ChevronDown, ChevronUp } from 'lucide-react';

export function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <CardHeader className="cursor-pointer select-none flex flex-row items-center justify-between py-3" onClick={() => setOpen(!open)}>
        <CardTitle className="text-base">{title}</CardTitle>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </CardHeader>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

export function RevenueLineChart({
  data,
}: {
  data: Array<{ label: string; value: number }>;
}) {
  if (!data.length) return null;
  const max = Math.max(1, ...data.map(d => d.value));
  const min = Math.min(0, ...data.map(d => d.value));
  const range = max - min || 1;
  const h = 180;
  const w = 100;
  const points = data.map((d, i) => {
    const x = (i / Math.max(1, data.length - 1)) * 100;
    const y = 100 - ((d.value - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,100 ${points} 100,100`;

  return (
    <div className="w-full">
      <div className="relative" style={{ height: h }}>
        <svg viewBox={`0 0 100 100`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <polygon points={areaPoints} fill="url(#revGrad)" />
          <polyline points={points} fill="none" stroke="#2563eb" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        </svg>
        {data.map((d, i) => {
          const x = (i / Math.max(1, data.length - 1)) * 100;
          const y = 100 - ((d.value - min) / range) * 100;
          return (
            <div
              key={i}
              className="absolute -translate-x-1/2 -translate-y-full group cursor-pointer"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <div className="w-2 h-2 rounded-full bg-blue-600 border-2 border-white shadow-sm" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                {d.label}: ₹{(d.value / 100).toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        {data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 6)) === 0 || i === data.length - 1).map((d, i) => (
          <span key={i} className="text-[10px] text-muted-foreground">{d.label}</span>
        ))}
      </div>
    </div>
  );
}

export function OrderBarChart({
  data,
}: {
  data: Array<{ label: string; value: number; color?: string }>;
}) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div className="w-full">
      <div className="flex items-end gap-2 h-32">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <span className="text-[10px] font-medium">{d.value}</span>
            <div
              className="w-full rounded-t-md transition-all duration-500"
              style={{
                height: `${Math.max(4, (d.value / max) * 100)}%`,
                backgroundColor: d.color || '#2563eb',
                opacity: 0.8,
              }}
            />
            <span className="text-[9px] text-muted-foreground truncate max-w-full">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
