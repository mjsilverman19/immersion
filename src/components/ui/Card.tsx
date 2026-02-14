import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: boolean;
}

export default function Card({ className = "", padding = true, children, ...props }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 ${
        padding ? "p-4" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
