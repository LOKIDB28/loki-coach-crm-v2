import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, children, className = "" }: FieldProps) {
  return (
    <div className={className}>
      <label className="block text-[13px] font-medium text-textSoft mb-1 tracking-[0.01em]">
        {label}
      </label>
      {children}
    </div>
  );
}
