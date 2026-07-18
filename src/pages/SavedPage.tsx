import { AppShell } from "@/components/AppShell";

const SavedPage = () => (
  <AppShell>
    <div className="px-6 py-10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Saved</p>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">
        Places you've kept for later will live here. Coming in a later phase.
      </p>
    </div>
  </AppShell>
);

export default SavedPage;
