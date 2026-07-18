import type { ReactNode } from "react";
import { BottomNav } from "@/components/BottomNav";

interface AppShellProps {
  children: ReactNode;
}

/** Cream shell with the serif wordmark and bottom nav. Used by non-map screens. */
export const AppShell = ({ children }: AppShellProps) => (
  <div className="min-h-[100dvh] bg-background pb-20">
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
      <h1 className="font-serif text-xl italic tracking-tight text-foreground">immersion</h1>
    </header>
    <main>{children}</main>
    <BottomNav />
  </div>
);
