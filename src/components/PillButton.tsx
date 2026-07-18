import { cn } from "@/lib/utils";

interface PillButtonProps {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export const PillButton = ({ children, active, onClick, className }: PillButtonProps) => (
  <button
    onClick={onClick}
    className={cn(
      "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
      active
        ? "bg-primary text-primary-foreground"
        : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      className
    )}
  >
    {children}
  </button>
);
