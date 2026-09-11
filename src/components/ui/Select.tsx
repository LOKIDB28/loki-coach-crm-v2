import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = "", children, ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          {...props}
          className={`w-full appearance-none rounded-lg bg-surface2 border border-border/20 px-3 py-2 pr-8 text-sm text-text focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 transition-colors ${className}`}
        >
          {children}
        </select>
        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-textSoft"
        />
      </div>
    );
  }
);
