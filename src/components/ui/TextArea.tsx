import { forwardRef, type TextareaHTMLAttributes } from "react";

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className = "", rows = 3, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        {...props}
        className={`w-full rounded-lg bg-surface2 border border-border/20 px-3 py-2 text-sm text-text placeholder:text-textSoft/60 focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/20 transition-colors resize-none ${className}`}
      />
    );
  }
);
