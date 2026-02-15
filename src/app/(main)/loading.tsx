export default function MainLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cream-dark border-t-ink" />
        <p className="text-sm text-ink-light">Loading...</p>
      </div>
    </div>
  );
}
