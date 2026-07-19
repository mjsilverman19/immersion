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
    <div className="brand-surface w-full max-w-md rounded-2xl p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Clock3 className="h-4 w-4 text-primary" />
        {formatTypicalTime(day, hour)}
      </div>
      <div className="mt-2.5 flex gap-1 overflow-x-auto scrollbar-hide" aria-label="Typical weekday">
        {WEEKDAYS.map((weekday) => (
          <button key={weekday.key} type="button" onClick={() => onDayChange(weekday.key)} aria-pressed={day === weekday.key} className={`min-h-9 min-w-10 flex-1 rounded-xl px-2 py-1.5 text-[11px] font-medium ${day === weekday.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-background/40 text-muted-foreground hover:bg-background/70 hover:text-foreground"}`}>
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
