import { useParams, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { HeartRating } from "@/components/HeartRating";
import { PillButton } from "@/components/PillButton";

/** Venue detail. Stub for now — renders the id and the card treatment. */
const VenuePage = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <AppShell>
      <div className="px-6 py-6">
        <Link
          to="/map"
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to map
        </Link>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Venue</p>
            <h2 className="mt-1 font-serif text-3xl leading-tight">Venue #{id}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Neighborhood · City</p>

            <div className="mt-4">
              <HeartRating rating={4} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <PillButton active>natural wine</PillButton>
              <PillButton>neighborhood spot</PillButton>
              <PillButton>late night</PillButton>
            </div>

            <p className="mt-5 text-sm italic leading-relaxed text-muted-foreground">
              A detailed guide entry lands in a later task.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};

export default VenuePage;
