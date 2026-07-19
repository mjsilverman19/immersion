import { AlertTriangle } from "lucide-react";

interface MapLoadingStateProps {
  progress: number;
  label: string;
  error: string | null;
}

export function MapLoadingState({ progress, label, error }: MapLoadingStateProps) {
  if (error) {
    return (
      <div role="alert" className="absolute inset-0 z-50 grid place-items-center bg-background/95 p-6">
        <div className="brand-surface max-w-sm rounded-2xl p-6 text-center">
          <AlertTriangle className="mx-auto h-6 w-6 text-primary" />
          <h2 className="mt-3 font-serif text-2xl">The NYC surface could not load</h2>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button type="button" onClick={() => window.location.reload()} className="brand-primary-button mt-5 text-sm">
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (progress >= 78) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-background/72 backdrop-blur-sm">
      <div className="brand-surface w-64 rounded-2xl p-5">
        <p className="font-serif text-xl">Opening New York</p>
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-right text-[10px] tabular-nums text-muted-foreground">{progress}%</p>
      </div>
    </div>
  );
}
