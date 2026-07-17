import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarClock, Trash2 } from "lucide-react";
import { LATEST_REPORT_KEY } from "@/lib/report-contract";
import {
  getReportHistory,
  removeReportFromHistory,
  type ReportHistoryItem,
} from "@/lib/report-history";
import { formatHongKongTime } from "@/lib/live-sources";
import { PageFrame, PageHeader, Reveal } from "@/components/verihk/PageChrome";


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
  const [items, setItems] = useState<ReportHistoryItem[]>([]);

  useEffect(() => {
    setItems(getReportHistory(window.localStorage));
  }, []);

  const openReport = (item: ReportHistoryItem) => {
    window.sessionStorage.setItem(LATEST_REPORT_KEY, JSON.stringify(item.report));
  };

  const deleteReport = (reportId: string) => {
    setItems(removeReportFromHistory(window.localStorage, reportId));
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Report archive"
        icon={<CalendarClock className="h-3.5 w-3.5" />}
        title="Verification history."
        description="Saved reports from this browser appear here after each completed verification."
        action={
          <Link
            to="/verify"
            className="inline-flex border-b border-[rgb(8_23_45_/_22%)] pb-1 text-base font-medium text-foreground transition-colors hover:border-[#0878f9] hover:text-primary"
          >
            New verification
          </Link>
        }
      />

      {items.length === 0 ? (
        <Reveal className="border-y border-[rgb(8_23_45_/_12%)] py-16">
          <div className="max-w-xl">
            <h2 className="text-2xl font-medium tracking-[-0.02em] text-[rgb(8_23_45_/_86%)]">
              No saved history yet.
            </h2>
            <p className="mt-3 text-base leading-7 text-[rgb(8_23_45_/_54%)]">
              New verification reports will appear here automatically for this browser. You can
              open or delete each saved report.
            </p>
          </div>
        </Reveal>
      ) : (
        <Reveal className="border-y border-[rgb(8_23_45_/_12%)]">
          {items.map((item) => (
            <div
              key={item.report_id}
              className="grid gap-4 border-b border-[rgb(8_23_45_/_10%)] py-5 last:border-b-0 md:grid-cols-[1fr_auto] md:items-center"
            >
              <Link
                to="/results"
                onClick={() => openReport(item)}
                className="group min-w-0 transition-colors hover:text-[#0878f9]"
              >
                <div className="text-sm text-[rgb(8_23_45_/_42%)]">
                  {formatHongKongTime(item.checked_at)}
                </div>
                <div className="mt-1 text-base font-medium tracking-[-0.01em] text-[rgb(8_23_45_/_86%)] group-hover:text-[#0878f9]">
                  {item.title}
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-[rgb(8_23_45_/_50%)]">
                  <span>{item.claims_count} claims</span>
                  <span>{item.supported_count} supported</span>
                  <span>{item.refuted_count} refuted</span>
                  <span>{item.insufficient_count} need evidence</span>
                  <span>{item.evidence_count} evidence items</span>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => deleteReport(item.report_id)}
                className="inline-flex items-center gap-2 text-sm font-medium text-[rgb(8_23_45_/_48%)] transition-colors hover:text-destructive md:justify-self-end"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          ))}
        </Reveal>
      )}
    </PageFrame>
  );
}
