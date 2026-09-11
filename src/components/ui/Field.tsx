import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

/** Uppercase brass-tinted label wrapper, matching the prototype's form field style. */
export function Field({ label, children, className = "" }: FieldProps) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-heading uppercase tracking-wider text-textSoft mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
