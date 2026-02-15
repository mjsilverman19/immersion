"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLogSheet } from "./LogSheetContext";
import PlaceSearch from "@/components/place/PlaceSearch";
import LogForm from "@/components/place/LogForm";
import { ToastProvider } from "@/components/ui/Toast";
import type { Place } from "@/lib/types/database";

export default function LogSheet() {
  const { isOpen, close } = useLogSheet();
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [creating, setCreating] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [visible, setVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimating(true));
      });
    } else {
      setAnimating(false);
      const timer = setTimeout(() => {
        setVisible(false);
        setSelectedPlace(null);
        setCreating(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSelect = async (place: Place) => {
    const ext = place as Place & { _isGoogle?: boolean };
    if (ext._isGoogle && place.google_place_id) {
      setCreating(true);
      try {
        const res = await fetch("/api/places/create-from-google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ google_place_id: place.google_place_id }),
        });
        if (res.ok) {
          const data = await res.json();
          setSelectedPlace(data.place);
        }
      } catch (err) {
        console.error("Error creating place:", err);
      } finally {
        setCreating(false);
      }
    } else {
      setSelectedPlace(place);
    }
  };

  const handleClose = () => {
    close();
    router.refresh();
  };

  if (!visible) return null;

  return (
    <ToastProvider>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-ink/40 transition-opacity duration-300 ${
          animating ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-[70] max-h-[90vh] overflow-y-auto rounded-t-2xl bg-cream shadow-2xl transition-transform duration-300 ease-out ${
          animating ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Handle */}
        <div className="sticky top-0 z-10 bg-cream px-4 pb-2 pt-3">
          <div className="mx-auto h-1 w-10 rounded-full bg-cream-dark" />
          <div className="mt-3 flex items-center justify-between">
            <h2 className="font-serif text-xl text-ink">Log a Place</h2>
            <button
              onClick={handleClose}
              className="rounded-full p-1.5 text-ink-light hover:bg-cream-dark"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-4 pb-8">
          {creating ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-ink-light">Adding place...</p>
            </div>
          ) : selectedPlace ? (
            <div>
              <button
                type="button"
                onClick={() => setSelectedPlace(null)}
                className="mb-4 flex items-center gap-1 text-sm text-ink-light hover:text-ink"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
                Back to search
              </button>
              <LogForm place={selectedPlace} />
            </div>
          ) : (
            <div>
              <p className="mb-4 text-sm text-ink-light">
                Search for a restaurant, cafe, bar, or any place you want to log.
              </p>
              <PlaceSearch onSelect={handleSelect} />
            </div>
          )}
        </div>
      </div>
    </ToastProvider>
  );
}
