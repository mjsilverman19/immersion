import { useState } from "react";
import { toast } from "sonner";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HeartRating } from "@/components/HeartRating";

interface QuickLogDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Quick log entry. Phase 1 has no backend or auth, so this keeps the visual
 * treatment and interaction but does not persist yet — it just confirms locally.
 * Wiring to a real logs store lands in a later task.
 */
export const QuickLogDrawer = ({ open, onOpenChange }: QuickLogDrawerProps) => {
  const [placeName, setPlaceName] = useState("");
  const [city, setCity] = useState("");
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setPlaceName("");
    setCity("");
    setRating(0);
    setNote("");
  };

  const handleLog = () => {
    setSaving(true);
    // No persistence in Phase 1 — acknowledge the entry and reset.
    toast.success("Added to your notebook", { description: `${placeName} · ${city}` });
    resetForm();
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="z-[1100] px-5 pb-8">
        <DrawerHeader className="px-0 pb-2 pt-4">
          <DrawerTitle className="font-serif text-lg">Log a place</DrawerTitle>
          <DrawerDescription className="text-xs text-muted-foreground">
            Add somewhere you loved to your notebook
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-4">
          <Input
            value={placeName}
            onChange={(e) => setPlaceName(e.target.value)}
            placeholder="Place name"
            className="text-sm"
          />

          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            className="text-sm"
          />

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Rating</span>
            <HeartRating rating={rating} onChange={setRating} size="md" />
          </div>

          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What made this place special?"
            className="text-sm"
          />

          <Button
            onClick={handleLog}
            className="w-full rounded-full"
            disabled={!placeName || !city || !rating || saving}
          >
            Log it
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
