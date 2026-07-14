import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, ExternalLink, Landmark } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { officialSources } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/sources")({
  head: () => ({
    meta: [
      { title: "Official Sources — VeriHK" },
      { name: "description", content: "Every trusted Hong Kong government source VeriHK verifies against." },
      { property: "og:title", content: "Official Sources — VeriHK" },
    ],
  }),
  component: SourcesPage,
});

function SourcesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
      <div className="mb-10 max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
          <Landmark className="h-3 w-3 text-primary" /> Verified Data Providers
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Official Sources</h1>
        <p className="mt-2 text-muted-foreground">
          Every claim is cross-checked against these trusted HKSAR government data providers.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {officialSources.map((s) => (
          <Card
            key={s.name}
            className="group flex h-full flex-col rounded-3xl border-border/60 p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-elegant"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl gradient-primary text-base font-bold text-white shadow-elegant">
                {s.logo}
              </div>
              <Badge variant="outline" className="gap-1 rounded-full border-success/30 bg-success/10 text-success">
                <BadgeCheck className="h-3 w-3" /> Official
              </Badge>
            </div>
            <div className="mt-5 space-y-1">
              <div className="text-base font-semibold">{s.name}</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {s.type}
              </div>
            </div>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
              {s.description}
            </p>
            <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
              <div className="text-[11px] text-muted-foreground">Updated: {s.updated}</div>
              <Button asChild size="sm" variant="outline" className="rounded-full">
                <a href={s.url} target="_blank" rel="noreferrer">
                  Visit <ExternalLink className="ml-1.5 h-3 w-3" />
                </a>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
