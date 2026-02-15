import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: boolean;
}

export default function Card({ className = "", padding = true, children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl bg-white shadow-sm ${
        padding ? "p-4" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
