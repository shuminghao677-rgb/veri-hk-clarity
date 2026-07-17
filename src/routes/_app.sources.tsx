import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Landmark } from "lucide-react";
import { officialSources } from "@/lib/mock-data";
import { SourceIcon } from "@/components/verihk/SourceIcon";
import { PageFrame, PageHeader, Reveal } from "@/components/verihk/PageChrome";


export const Route = createFileRoute("/_app/sources")({
  head: () => ({
    meta: [
      { title: "Official Sources — VeriHK" },
      { name: "description", content: "Official Hong Kong sources used by VeriHK." },
      { property: "og:title", content: "Official Sources — VeriHK" },
    ],
  }),
  component: SourcesPage,
});

function SourcesPage() {
  return (
    <PageFrame>
      <PageHeader
        eyebrow="Official source graph"
        icon={<Landmark className="h-3.5 w-3.5" />}
        title="The trusted layer underneath every report."
        description="VeriHK uses official government endpoints and feeds where available. The verification engine decides how each source contributes to the report."
      />

      <Reveal className="border-y border-[rgb(8_23_45_/_12%)]">
        <div className="hidden grid-cols-[1.1fr_0.7fr_1.4fr_auto] gap-6 border-b border-[rgb(8_23_45_/_10%)] py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[rgb(8_23_45_/_42%)] md:grid">
          <div>Source</div>
          <div>Type</div>
          <div>Use</div>
          <div>Status</div>
        </div>
        {officialSources.map((source) => (
          <div
            key={source.key}
            className="grid gap-4 border-b border-[rgb(8_23_45_/_10%)] py-5 last:border-b-0 md:grid-cols-[1.1fr_0.7fr_1.4fr_auto] md:items-center md:gap-6"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-[rgb(8_23_45_/_12%)] bg-white">
                <SourceIcon sourceKey={source.key} className="h-4 w-4" />
              </span>
              <div>
                <div className="text-sm font-semibold text-[rgb(8_23_45_/_86%)]">{source.name}</div>
                <div className="text-xs text-[rgb(8_23_45_/_42%)]">Updated {source.updated}</div>
              </div>
            </div>
            <div className="text-sm text-[rgb(8_23_45_/_58%)]">{source.type}</div>
            <div className="text-sm leading-6 text-[rgb(8_23_45_/_62%)]">{source.description}</div>
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-bold text-foreground transition-colors hover:text-primary"
            >
              Open <ExternalLink className="ml-1 inline h-3.5 w-3.5" />
            </a>

          </div>
        ))}
      </Reveal>
    </PageFrame>
  );
}
