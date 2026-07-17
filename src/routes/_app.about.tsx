import { createFileRoute, Link } from "@tanstack/react-router";
import { PageFrame, PageHeader, Reveal } from "@/components/verihk/PageChrome";

export const Route = createFileRoute("/_app/about")({
  head: () => ({
    meta: [
      { title: "About — VeriHK" },
      {
        name: "description",
        content: "Designer note and verification logic behind VeriHK.",
      },
      { property: "og:title", content: "About — VeriHK" },
    ],
  }),
  component: AboutPage,
});

const verificationLogic = [
  {
    area: "Weather",
    source: "Hong Kong Observatory",
    logic:
      "Weather-warning claims are checked against the current HKO warning summary. If the claimed active warning is present, the claim can be supported; if the warning group is available and the claimed warning is absent, the claim can be refuted for the current snapshot.",
  },
  {
    area: "Transportation",
    source: "Transport Department",
    logic:
      "Road closure, reopening, congestion and public-transport disruption claims are matched against live Transport Department records. The matcher compares road, location, direction, event state, scope and service metadata before attaching evidence.",
  },
  {
    area: "News",
    source: "GovHK limited source check",
    logic:
      "GovHK is currently treated as a limited official-source check. Recent government news and RSS items may be used only when they are directly relevant to a claim; generic or unrelated announcements are not attached as evidence.",
  },
  {
    area: "Education",
    source: "Education Bureau planned route",
    logic:
      "Education Bureau routing is planned as a future module. The current prototype does not claim full school-arrangement verification; ordinary education news does not count as school-suspension evidence unless a directly relevant official notice is available.",
  },
];

const teamMembers = [
  {
    name: "Teresa",
    department: "City University of Hong Kong — Computer Science Department",
    email: "xinyun.f@outlook.com",
  },
  {
    name: "Vincent",
    department: "City University of Hong Kong — Data Science Department",
    email: "vincentorsister@gmail.com",
  },
];

function AboutPage() {
  return (
    <PageFrame>
      <PageHeader
        eyebrow="Designer note"
        title="VeriHK is designed as a calm interface for public trust."
        description="The design avoids a government-dashboard look and uses a lighter editorial system: restrained typography, white space, thin dividers and clear source reasoning. The goal is to help judges and users understand not only the verdict, but why the verdict was reached."
        action={
          <Link
            to="/verify"
            className="inline-flex border-b border-[rgb(8_23_45_/_22%)] pb-1 text-base font-medium text-foreground transition-colors hover:border-[#0878f9] hover:text-primary"
          >
            Try the verification flow
          </Link>
        }
      />

      <Reveal className="mt-16">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgb(8_23_45_/_42%)]">
            Team
          </div>
          <h2 className="mt-3 text-3xl font-medium leading-tight tracking-[-0.02em] text-[rgb(8_23_45_/_88%)] md:text-4xl">
            Built by a small interdisciplinary team.
          </h2>
        </div>

        <div className="mt-8 border-y border-[rgb(8_23_45_/_12%)]">
          {teamMembers.map((member) => (
            <div
              key={member.email}
              className="grid gap-4 border-b border-[rgb(8_23_45_/_10%)] py-6 last:border-b-0 md:grid-cols-[220px_1fr] md:items-start"
            >
              <div className="text-xl font-medium tracking-[-0.02em] text-[rgb(8_23_45_/_88%)]">
                {member.name}
              </div>
              <div className="max-w-3xl">
                <div className="text-base leading-7 text-[rgb(8_23_45_/_60%)]">
                  {member.department}
                </div>
                <a
                  href={`mailto:${member.email}`}
                  className="mt-2 inline-flex border-b border-[rgb(8_23_45_/_18%)] pb-0.5 text-sm font-medium text-[rgb(8_23_45_/_72%)] transition-colors hover:border-primary hover:text-primary"
                >
                  {member.email}
                </a>
              </div>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal className="mt-20">
        <div className="max-w-3xl">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[rgb(8_23_45_/_42%)]">
            Verification logic
          </div>
          <h2 className="mt-3 text-3xl font-medium leading-tight tracking-[-0.02em] text-[rgb(8_23_45_/_88%)] md:text-4xl">
            How official evidence is routed.
          </h2>
          <p className="mt-4 text-base leading-7 text-[rgb(8_23_45_/_58%)]">
            The frontend presents the report, but the verification engine decides how each official
            source is queried, matched and interpreted.
          </p>
        </div>

        <div className="mt-10 border-y border-[rgb(8_23_45_/_12%)]">
          {verificationLogic.map((item) => (
            <section
              key={item.area}
              className="grid gap-5 border-b border-[rgb(8_23_45_/_10%)] py-7 last:border-b-0 md:grid-cols-[180px_220px_1fr]"
            >
              <div className="text-xl font-medium tracking-[-0.02em] text-[rgb(8_23_45_/_88%)]">
                {item.area}
              </div>
              <div className="text-sm font-medium text-[rgb(8_23_45_/_50%)]">{item.source}</div>
              <p className="max-w-3xl text-base leading-7 text-[rgb(8_23_45_/_60%)]">
                {item.logic}
              </p>
            </section>
          ))}
        </div>
      </Reveal>

      <Reveal className="mt-16 grid gap-8 border-t border-[rgb(8_23_45_/_10%)] pt-10 md:grid-cols-[240px_1fr]">
        <div className="text-sm font-semibold text-[rgb(8_23_45_/_84%)]">Scope</div>
        <p className="max-w-3xl text-base leading-7 text-[rgb(8_23_45_/_58%)]">
          VeriHK currently favors live retrieval over a full historical database. That keeps the
          competition prototype lightweight while leaving a clear path for scheduled ingestion,
          deduplication, upserts and long-term source archives later.
        </p>
      </Reveal>
    </PageFrame>
  );
}
