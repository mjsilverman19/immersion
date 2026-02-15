"use client";

import { ToastProvider } from "@/components/ui/Toast";
import LogForm from "@/components/place/LogForm";
import type { Place } from "@/lib/types/database";

interface LogFormWrapperProps {
  place: Place;
  userId: string;
  existingLog: {
    id: string;
    rating: number;
    tags: string[];
    vibe_tags?: string[];
    review: string | null;
  } | null;
}

export default function LogFormWrapper({
  place,
  existingLog,
}: LogFormWrapperProps) {
  return (
    <ToastProvider>
      <LogForm place={place} existingLog={existingLog} />
    </ToastProvider>
  );
}
