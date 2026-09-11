import { forwardRef, type InputHTMLAttributes } from "react";

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className = "", ...props }, ref) {
    return (
      <input
        ref={ref}
        {...props}
        className={`w-full rounded-md bg-surface2 border border-border px-3 py-2 text-sm text-text placeholder:text-textFaint focus:outline-none focus:border-brass transition-colors ${className}`}
      />
    );
  }
);
