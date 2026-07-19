import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

import { loadManifest } from "@/lib/dataLoader";
import type { DatasetManifest } from "@/types/data";

const Methodology = () => {
  const [manifest, setManifest] = useState<DatasetManifest | null>(null);
  useEffect(() => {
    loadManifest().then(setManifest).catch(() => setManifest(null));
  }, []);

  return (
    <main className="min-h-[100dvh] bg-background px-5 py-7 text-foreground md:px-10 md:py-10">
      <div className="mx-auto max-w-2xl">
        <Link to="/map" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to map</Link>
        <p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Methodology</p>
        <h1 className="mt-2 font-serif text-4xl leading-[1.05] md:text-5xl">A modeled typical week, not live tracking.</h1>
        <p className="mt-5 text-base leading-relaxed text-muted-foreground">Immersion combines several separate signals to reveal where New York may feel active and worth exploring at a chosen time. It does not display live people counts or individual mobility traces.</p>

        <section className="mt-10 space-y-7">
          <Method title="Activity">A modeled index of typical discretionary activity. The hourly surface represents the shape of a typical week, not what is happening right now.</Method>
          <Method title="Local orientation">A proxy index for signals associated with locally oriented places and patterns. It is not a percentage of residents or a demographic count.</Method>
          <Method title="Visitor pressure">A separate proxy index for visitor-oriented pressure, based on supporting place and activity evidence. It is not a percentage of tourists.</Method>
          <Method title="Confidence">The strength and coverage of underlying evidence. Low-confidence cells are visually quieter and should not be treated as strong recommendations.</Method>
          <Method title="Recommendations">The product combines time-relevant activity, useful venue supply, variety, room to wander, and evidence confidence. Local-orientation and visitor-pressure proxies make a small background adjustment but are not presented as facts about an audience.</Method>
          <Method title="Taste">Five optional choices can change an area by no more than approximately 30% of its baseline relevance. Low-confidence areas stay closer to baseline, and users can always compare their map with the city baseline.</Method>
          <Method title="Venue quality">External quality evidence is an eligibility guardrail and contributes no more than 10% as a tie-breaker. It does not create a citywide leaderboard, and raw provider ratings are not shown.</Method>
        </section>

        <section className="brand-card mt-10 p-5">
          <h2 className="font-serif text-2xl">Current footprint</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{manifest?.coverageLabel ?? "The current NYC dataset covers a limited pilot geography."}</p>
          {manifest && <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 text-sm"><dt className="text-muted-foreground">Dataset</dt><dd>{manifest.datasetVersion}</dd><dt className="text-muted-foreground">Generated</dt><dd>{new Date(manifest.generatedAt).toLocaleDateString()}</dd><dt className="text-muted-foreground">Resolution</dt><dd>Hourly · H3 resolution {manifest.hexResolution}</dd></dl>}
        </section>

        <details className="mt-8 border-t border-border py-6">
          <summary className="cursor-pointer text-sm font-semibold">Technical details</summary>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground"><p>Geometry and time metrics are separate artifacts. The app loads the manifest, supported H3 geometry, and the selected weekday first, then lazy-loads venue data.</p><p>The exporter assigns supported cells to NYC neighborhood polygons and derives category density, diversity, wandering, and anchor-concentration features from the actual venue inventory. Missing evidence is not treated as zero.</p><p>Area scoring uses 45% relative activity, 25% intent-relevant supply, 12% diversity, 13% wandering potential, and a 5% background orientation adjustment, then applies evidence confidence. Taste uses a capped multiplicative adjustment with α = 0.3.</p><p>Venue ranking uses intent and taste fit as primary terms, typical category timing and area context as supporting terms, and quality prior as a 10% tie-breaker.</p></div>
        </details>
      </div>
    </main>
  );
};

function Method({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h2 className="font-serif text-2xl">{title}</h2><p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{children}</p></div>;
}

export default Methodology;
