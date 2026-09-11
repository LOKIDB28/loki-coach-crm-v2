import { forwardRef, type TextareaHTMLAttributes } from "react";

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className = "", rows = 3, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        {...props}
        className={`w-full rounded-md bg-surface2 border border-border px-3 py-2 text-sm text-text placeholder:text-textFaint focus:outline-none focus:border-brass transition-colors resize-none ${className}`}
      />
    );
  }
);
