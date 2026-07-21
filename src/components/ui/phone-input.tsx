"use client";

import { useState, useCallback } from "react";
import { Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";

export const COUNTRY_CODES: { code: string; name: string; flag: string }[] = [
  { code: "+91", name: "India", flag: "🇮🇳" },
  { code: "+1", name: "United States", flag: "🇺🇸" },
  { code: "+44", name: "United Kingdom", flag: "🇬🇧" },
  { code: "+61", name: "Australia", flag: "🇦🇺" },
  { code: "+86", name: "China", flag: "🇨🇳" },
  { code: "+49", name: "Germany", flag: "🇩🇪" },
  { code: "+33", name: "France", flag: "🇫🇷" },
  { code: "+81", name: "Japan", flag: "🇯🇵" },
  { code: "+7", name: "Russia", flag: "🇷🇺" },
  { code: "+55", name: "Brazil", flag: "🇧🇷" },
  { code: "+971", name: "UAE", flag: "🇦🇪" },
  { code: "+966", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "+65", name: "Singapore", flag: "🇸🇬" },
  { code: "+60", name: "Malaysia", flag: "🇲🇾" },
  { code: "+63", name: "Philippines", flag: "🇵🇭" },
  { code: "+92", name: "Pakistan", flag: "🇵🇰" },
  { code: "+880", name: "Bangladesh", flag: "🇧🇩" },
  { code: "+94", name: "Sri Lanka", flag: "🇱🇰" },
  { code: "+977", name: "Nepal", flag: "🇳🇵" },
];

export function validatePhoneDigits(digits: string, countryCode: string): string | null {
  if (!digits) return "Phone number is required";
  if (!/^\d+$/.test(digits)) return "Phone number can only contain digits";

  switch (countryCode) {
    case "+91":
      if (digits.length !== 10) return "Indian numbers must be 10 digits";
      if (!/^[6-9]/.test(digits)) return "Indian numbers must start with 6, 7, 8, or 9";
      break;
    case "+1":
      if (digits.length !== 10) return "US numbers must be 10 digits";
      break;
    default:
      if (digits.length < 7 || digits.length > 14) return "Phone number must be 7–14 digits";
  }
  return null;
}

export interface PhoneInputProps {
  id?: string;
  value: string;
  countryCode: string;
  onChange: (phoneDigits: string, countryCode: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  required?: boolean;
  className?: string;
  onEnter?: () => void;
  disabled?: boolean;
}

export function PhoneInput({
  id,
  value,
  countryCode,
  onChange,
  placeholder = "98765 43210",
  autoFocus,
  required,
  className,
  onEnter,
  disabled,
}: PhoneInputProps) {
  const [touched, setTouched] = useState(false);
  const error = touched ? validatePhoneDigits(value, countryCode) : null;

  const handleDigitsChange = useCallback(
    (raw: string) => {
      const digits = raw.replace(/\D/g, "");
      onChange(digits, countryCode);
      if (!touched) setTouched(true);
    },
    [countryCode, onChange, touched]
  );

  const handleCountryChange = useCallback(
    (code: string) => {
      onChange(value, code);
      if (!touched && value) setTouched(true);
    },
    [value, onChange, touched]
  );

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex gap-2">
        <Select
          value={countryCode}
          onChange={(e) => handleCountryChange(e.target.value)}
          className="w-[105px] shrink-0"
          disabled={disabled}
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.code}
            </option>
          ))}
        </Select>
        <div className="relative flex-1">
          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={id}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder={placeholder}
            value={value}
            onChange={(e) => handleDigitsChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && onEnter && !error && value) onEnter();
            }}
            onBlur={() => setTouched(true)}
            className={cn("pl-10", error && "border-destructive")}
            autoFocus={autoFocus}
            required={required}
            disabled={disabled}
          />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
