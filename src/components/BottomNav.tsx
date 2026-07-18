import { useState } from "react";
import { Map, Plus, Bookmark } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { QuickLogDrawer } from "@/components/QuickLogDrawer";

// Search now lives on the map screen, so the nav is just Map and Saved (with the
// center Log action between them).
const tabs = [
  { to: "/map", icon: Map, label: "Map" },
  { to: "/saved", icon: Bookmark, label: "Saved" },
];

export const BottomNav = () => {
  const [logOpen, setLogOpen] = useState(false);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "relative flex flex-1 flex-col items-center gap-1 py-1 text-[10px] font-medium tracking-wide transition-colors",
      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
    );

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-[1001] border-t border-border bg-background">
        <div className="mx-auto flex max-w-lg items-end justify-around pb-1 pt-1.5">
          {tabs.slice(0, 1).map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={linkClass}>
              <Icon className="h-[22px] w-[22px] stroke-[1.5]" />
              <span>{label}</span>
            </NavLink>
          ))}

          {/* Center Log button */}
          <button
            onClick={() => setLogOpen(true)}
            className="relative flex flex-1 flex-col items-center gap-1 pb-0.5"
            aria-label="Log a place"
          >
            <div className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-foreground shadow-lg">
              <Plus className="h-5 w-5 stroke-[2] text-background" />
            </div>
            <span className="text-[10px] font-medium tracking-wide text-muted-foreground">Log</span>
          </button>

          {tabs.slice(1).map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={linkClass}>
              <Icon className="h-[22px] w-[22px] stroke-[1.5]" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <QuickLogDrawer open={logOpen} onOpenChange={setLogOpen} />
    </>
  );
};
