import { Clock3 } from "lucide-react";

import { formatTypicalTime, WEEKDAYS } from "@/lib/time";
import type { WeekdayKey } from "@/types/data";

interface TypicalTimeControlProps {
  day: WeekdayKey;
  hour: number;
  onDayChange: (day: WeekdayKey) => void;
  onHourChange: (hour: number) => void;
}

export function TypicalTimeControl({ day, hour, onDayChange, onHourChange }: TypicalTimeControlProps) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-background/94 p-3 shadow-lg backdrop-blur">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Clock3 className="h-4 w-4 text-primary" />
        {formatTypicalTime(day, hour)}
      </div>
      <div className="mt-2.5 flex gap-1 overflow-x-auto scrollbar-hide" aria-label="Typical weekday">
        {WEEKDAYS.map((weekday) => (
          <button key={weekday.key} type="button" onClick={() => onDayChange(weekday.key)} aria-pressed={day === weekday.key} className={`min-w-10 flex-1 rounded-lg px-2 py-1.5 text-[11px] ${day === weekday.key ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
            {weekday.short}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <span className="text-[10px] text-muted-foreground">12 a.m.</span>
        <input aria-label="Typical hour" type="range" min={0} max={23} step={1} value={hour} onChange={(event) => onHourChange(Number(event.target.value))} className="h-1.5 flex-1 cursor-pointer accent-primary" />
        <span className="text-[10px] text-muted-foreground">11 p.m.</span>
      </div>
    </div>
  );
}
