"use client";

import { useEffect, useState } from "react";

interface CurrencyInputProps {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

const fmt = new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 2 });

/**
 * Ported from the prototype's CurrencyInput: shows a "$" prefix, and
 * formats the value with fr-CA thousands separators when not focused;
 * while focused it shows the raw editable number so the separators don't
 * fight the cursor.
 */
export function CurrencyInput({
  value,
  onChange,
  placeholder,
  className = "",
  id,
}: CurrencyInputProps) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!focused) {
      setDraft(value === null || value === undefined ? "" : String(value));
    }
  }, [value, focused]);

  const displayValue = focused
    ? draft
    : value === null || value === undefined
    ? ""
    : fmt.format(value);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-textSoft text-sm">
        $
      </span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        value={displayValue}
        onFocus={() => {
          setFocused(true);
          setDraft(value === null || value === undefined ? "" : String(value));
        }}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d.,]/g, "");
          setDraft(raw);
        }}
        onBlur={() => {
          setFocused(false);
          const normalized = draft.replace(/,/g, "").trim();
          if (normalized === "") {
            onChange(null);
          } else {
            const n = Number(normalized);
            onChange(Number.isFinite(n) ? n : null);
          }
        }}
        className={`w-full rounded-md bg-surface2 border border-border pl-7 pr-3 py-2 text-sm text-text placeholder:text-textFaint focus:outline-none focus:border-brass transition-colors ${className}`}
      />
    </div>
  );
}
