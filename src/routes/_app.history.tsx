import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, ShieldCheck, XCircle } from "lucide-react";
import { historyReports } from "@/lib/mock-data";


export const Route = createFileRoute("/_app/history")({
  head: () => ({
    meta: [
      { title: "History — VeriHK" },
      { name: "description", content: "Previous VeriHK verification reports." },
      { property: "og:title", content: "History — VeriHK" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  return (
    <div className="premium-container py-10 md:py-16">
      <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[rgb(8_23_45_/_42%)]">
            <CalendarClock className="h-3.5 w-3.5" />
            Report archive
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-normal text-[rgb(8_23_45_/_90%)] md:text-6xl">
            Verification history.
          </h1>
        </div>
        <Link
          to="/verify"
          className="text-base font-bold text-foreground transition-colors hover:text-primary"
        >
          New verification
        </Link>

      </div>

      <div className="border-y border-[rgb(8_23_45_/_12%)]">
        {historyReports.map((report) => (
          <Link
            key={report.id}
            to="/results"
            className="grid gap-3 border-b border-[rgb(8_23_45_/_10%)] py-5 transition-colors last:border-b-0 hover:text-[#0878f9] md:grid-cols-[0.7fr_1.5fr_0.9fr_auto] md:items-center"
          >
            <div className="text-sm text-[rgb(8_23_45_/_42%)]">{report.date}</div>
            <div>
              <div className="text-base font-semibold text-[rgb(8_23_45_/_86%)]">{report.title}</div>
              <div className="mt-1 text-sm text-[rgb(8_23_45_/_48%)]">{report.claims} claims</div>
            </div>
            <div className="flex items-center gap-4 text-sm text-[rgb(8_23_45_/_58%)]">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-[#12805c]" />
                {report.supported}
              </span>
              <span className="inline-flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5 text-[#d92d20]" />
                {report.refuted}
              </span>
            </div>
            <div className="text-sm font-medium text-[rgb(8_23_45_/_72%)]">
              {report.confidence}% confidence
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
