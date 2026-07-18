import { useState } from "react";

import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { HeartRating } from "@/components/HeartRating";
import { PillButton } from "@/components/PillButton";
import { QuickLogDrawer } from "@/components/QuickLogDrawer";
import { Button } from "@/components/ui/button";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</p>
    {children}
  </section>
);

/** Scratch page to eyeball the ported components in isolation. Not shipped UI. */
const Storybook = () => {
  const [rating, setRating] = useState(3);
  const [filter, setFilter] = useState("restaurants");
  const [logOpen, setLogOpen] = useState(false);

  return (
    <AppShell>
      <div className="space-y-9 px-6 py-6">
        <h2 className="font-serif text-3xl leading-tight">Component scratchbook</h2>

        <Section title="Heart rating">
          <div className="flex flex-col gap-3">
            <HeartRating rating={4} size="sm" />
            <HeartRating rating={rating} onChange={setRating} size="lg" />
            <p className="text-xs text-muted-foreground">Interactive: {rating}/5</p>
          </div>
        </Section>

        <Section title="Pill buttons">
          <div className="flex flex-wrap gap-2">
            {["restaurants", "natural wine", "late night", "coffee"].map((v) => (
              <PillButton key={v} active={filter === v} onClick={() => setFilter(v)}>
                {v}
              </PillButton>
            ))}
          </div>
        </Section>

        <Section title="Card treatment">
          <Card>
            <CardContent className="p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Prospect Heights · Brooklyn
              </p>
              <h3 className="mt-1 font-serif text-2xl leading-tight">Christof</h3>
              <div className="mt-3">
                <HeartRating rating={5} />
              </div>
              <p className="mt-3 text-sm italic leading-relaxed text-muted-foreground">
                "Natural wine, neighborhood spot. The kind of place you'd send one friend."
              </p>
            </CardContent>
          </Card>
        </Section>

        <Section title="Quick log drawer">
          <Button variant="outline" className="rounded-full" onClick={() => setLogOpen(true)}>
            Open quick log
          </Button>
          <QuickLogDrawer open={logOpen} onOpenChange={setLogOpen} />
        </Section>
      </div>
    </AppShell>
  );
};

export default Storybook;
