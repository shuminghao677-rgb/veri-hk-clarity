import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { TrafficMapEvidenceItem } from "@/lib/traffic-map-utils";
import { getTrafficVerdictLabel } from "@/lib/traffic-map-utils";

type TrafficEvidenceMapLeafletProps = {
  items: TrafficMapEvidenceItem[];
  activeId: string;
  onSelect: (id: string) => void;
  onMapFailure: () => void;
  formatTime: (value: string) => string;
};

export default function TrafficEvidenceMapLeaflet({
  items,
  activeId,
  onSelect,
  onMapFailure,
  formatTime,
}: TrafficEvidenceMapLeafletProps) {
  const locatedItems = items.filter((item) => item.location);
  const activeItem = locatedItems.find((item) => item.id === activeId) ?? locatedItems[0];
  const center = activeItem?.location?.coordinates ?? locatedItems[0]?.location?.coordinates;
  const bounds = useMemo(() => {
    const coordinates = locatedItems.flatMap((item) =>
      item.location ? [item.location.coordinates] : [],
    );
    return coordinates.length > 1 ? L.latLngBounds(coordinates) : null;
  }, [locatedItems]);

  if (!center) return null;

  return (
    <div className="relative h-full">
      <style>{trafficMapLeafletStyles}</style>
      <MapContainer
        center={center}
        zoom={16}
        minZoom={12}
        maxZoom={18}
        scrollWheelZoom={false}
        className="h-full w-full"
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{ tileerror: onMapFailure }}
        />
        <MapViewport center={center} bounds={bounds} activeId={activeItem.id} />
        {locatedItems.map((item) => (
          <Marker
            key={item.id}
            position={item.location!.coordinates}
            icon={createEvidenceIcon(item.id === activeItem.id, Boolean(item.metadata.direction))}
            eventHandlers={{
              click: () => {
                onSelect(item.id);
                window.setTimeout(() => {
                  document
                    .getElementById(`traffic-map-card-${item.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }, 50);
              },
            }}
            keyboard
            alt={`${item.metadata.road_name ?? "Traffic evidence"} location`}
          >
            <Popup>
              <div className="min-w-[220px] text-sm">
                <div className="font-semibold">
                  {item.metadata.route_or_line ?? item.metadata.road_name ?? item.evidence.title}
                </div>
                {item.metadata.station_or_stop && (
                  <div className="mt-1 text-xs">Station or Stop: {item.metadata.station_or_stop}</div>
                )}
                {item.metadata.direction && (
                  <div className="mt-1 text-xs">Direction: {item.metadata.direction}</div>
                )}
                <div className="mt-1 text-xs">
                  Event Type:{" "}
                  {item.metadata.service_status ??
                    item.metadata.scope ??
                    item.metadata.event_type ??
                    "Not stated"}
                </div>
                <div className="mt-1 text-xs">
                  Coordinate Source:{" "}
                  {item.location?.approximate ? "Approximate demo location" : "Official TD coordinates"}
                </div>
                <div className="mt-1 text-xs">
                  Official Update: {formatOptionalTime(item.evidence.updated_at, formatTime)}
                </div>
                <div className="mt-1 text-xs">
                  Verification Result: {getTrafficVerdictLabel(item.verdict)}
                </div>
                <a
                  href={item.evidence.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs font-medium text-blue-700 underline"
                >
                  Open official TD source
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

function MapViewport({
  center,
  bounds,
  activeId,
}: {
  center: [number, number];
  bounds: L.LatLngBounds | null;
  activeId: string;
}) {
  const map = useMap();

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [56, 56], maxZoom: 16 });
    } else {
      map.setView(center, 16, { animate: true });
    }
  }, [activeId, bounds, center, map]);

  return null;
}

function createEvidenceIcon(active: boolean, hasDirection: boolean) {
  return L.divIcon({
    className: "",
    html: `<div class="verihk-traffic-marker ${active ? "is-active" : ""}">
      <span class="verihk-traffic-marker-dot"></span>
      ${hasDirection ? '<span class="verihk-traffic-marker-arrow"></span>' : ""}
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

const trafficMapLeafletStyles = `
.leaflet-container {
  background: #eef6fb;
  font-family: inherit;
}
.leaflet-control-attribution {
  border-radius: 12px 0 0 0;
  font-size: 10px;
}
.verihk-traffic-marker {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: rgba(14, 165, 233, 0.14);
  border: 1px solid rgba(14, 165, 233, 0.26);
  box-shadow: 0 14px 32px rgba(14, 165, 233, 0.24);
  transition: transform 180ms ease, box-shadow 180ms ease;
}
.verihk-traffic-marker.is-active {
  transform: scale(1.12);
  box-shadow: 0 18px 42px rgba(14, 165, 233, 0.34);
}
.verihk-traffic-marker-dot {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: #0284c7;
  border: 3px solid #fff;
}
.verihk-traffic-marker-arrow {
  position: absolute;
  right: -3px;
  top: 15px;
  width: 16px;
  height: 8px;
  border-top: 2px solid #0284c7;
  border-right: 2px solid #0284c7;
  transform: rotate(45deg);
  animation: verihkArrowPulse 1.8s ease-in-out infinite;
}
@keyframes verihkArrowPulse {
  0%, 100% { opacity: 0.45; transform: translateX(0) rotate(45deg); }
  50% { opacity: 1; transform: translateX(3px) rotate(45deg); }
}
`;

function formatOptionalTime(value: string | null, formatTime: (value: string) => string): string {
  return value ? formatTime(value) : "Not stated";
}
