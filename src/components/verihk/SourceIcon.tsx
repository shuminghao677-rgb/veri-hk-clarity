import {
  CloudRain,
  Bus,
  GraduationCap,
  Megaphone,
  Database,
  Waves,
  Landmark,
  type LucideIcon,
} from "lucide-react";
import type { SourceKey } from "@/lib/mock-data";

const iconMap: Record<SourceKey, LucideIcon> = {
  hko: CloudRain,
  td: Bus,
  edb: GraduationCap,
  govnews: Megaphone,
  datagov: Database,
  dsd: Waves,
};

export function getSourceIcon(key: SourceKey): LucideIcon {
  return iconMap[key] ?? Landmark;
}

export function SourceIcon({
  sourceKey,
  className = "h-5 w-5",
}: {
  sourceKey: SourceKey;
  className?: string;
}) {
  const Icon = getSourceIcon(sourceKey);
  return <Icon className={className} aria-hidden />;
}

export function SourceBadge({
  sourceKey,
  shortName,
  size = "md",
}: {
  sourceKey: SourceKey;
  shortName: string;
  size?: "sm" | "md" | "lg";
}) {
  const box =
    size === "lg" ? "h-11 w-11 rounded-2xl" : size === "sm" ? "h-6 w-6 rounded-md" : "h-9 w-9 rounded-xl";
  const iconSize = size === "lg" ? "h-5 w-5" : size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const text = size === "sm" ? "text-[9px]" : "text-[10px]";
  return (
    <div className="inline-flex items-center gap-2">
      <div
        className={`${box} grid place-items-center border border-border/70 bg-muted/60 text-foreground/80`}
        aria-hidden
      >
        <SourceIcon sourceKey={sourceKey} className={iconSize} />
      </div>
      <span className={`${text} font-semibold uppercase tracking-wider text-muted-foreground`}>
        {shortName}
      </span>
    </div>
  );
}
