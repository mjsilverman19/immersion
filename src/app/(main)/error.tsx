"use client";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4">
      <h2 className="font-serif text-xl text-ink">Something went wrong</h2>
      <p className="mt-2 text-sm text-ink-light">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-full bg-ink px-4 py-2 text-sm text-cream"
      >
        Try again
      </button>
    </div>
  );
}
