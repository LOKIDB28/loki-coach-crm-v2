import { forwardRef, type InputHTMLAttributes } from "react";

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className = "", ...props }, ref) {
    return (
      <input
        ref={ref}
        {...props}
        className={`w-full rounded-lg bg-surface2 border border-border/20 px-3 py-2 text-sm text-text placeholder:text-textSoft/60 focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 transition-colors ${className}`}
      />
    );
  }
);
