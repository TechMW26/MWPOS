"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface QuantityControlProps {
  value: number;
  onChange: (value: number) => void;
}

const BULK_QUANTITIES = [100, 500, 1000];

export function QuantityControl({ value, onChange }: QuantityControlProps) {
  function setQuantity(next: number) {
    onChange(Number.isFinite(next) ? Math.max(0, Math.floor(next)) : 0);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setQuantity(value - 1)} aria-label="Decrease quantity">
        <Minus className="h-3 w-3" />
      </Button>
      <Input
        type="number"
        min="0"
        inputMode="numeric"
        className="h-8 w-20 text-center"
        value={value}
        onChange={(event) => setQuantity(Number(event.target.value))}
        aria-label="Quantity"
      />
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => setQuantity(value + 1)} aria-label="Increase quantity">
        <Plus className="h-3 w-3" />
      </Button>
      <div className="flex gap-1">
        {BULK_QUANTITIES.map((quantity) => (
          <Button key={quantity} type="button" size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => setQuantity(quantity)}>
            {quantity}
          </Button>
        ))}
      </div>
    </div>
  );
}
