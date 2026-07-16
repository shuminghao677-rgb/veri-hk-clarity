export type TrafficMapCoordinate = [number, number];

export type TrafficMapLocation = {
  key: string;
  roadName: string;
  nearbyLandmark: string;
  district: string;
  coordinates: TrafficMapCoordinate;
  label: string;
  approximate: boolean;
  sourceName: string;
  sourceUrl: string;
};

export const trafficMapLocations: Record<string, TrafficMapLocation> = {
  "princess-margaret-road-pui-ching-road": {
    key: "princess-margaret-road-pui-ching-road",
    roadName: "Princess Margaret Road",
    nearbyLandmark: "Pui Ching Road",
    district: "Ho Man Tin",
    coordinates: [22.3158, 114.1781],
    label: "Princess Margaret Road near Pui Ching Road",
    approximate: true,
    sourceName: "OpenStreetMap road context",
    sourceUrl:
      "https://www.openstreetmap.org/search?query=Princess%20Margaret%20Road%20Pui%20Ching%20Road%20Hong%20Kong",
  },
  "princess-margaret-road-near-pui-ching-road": {
    key: "princess-margaret-road-near-pui-ching-road",
    roadName: "Princess Margaret Road",
    nearbyLandmark: "Pui Ching Road",
    district: "Ho Man Tin",
    coordinates: [22.3158, 114.1781],
    label: "Princess Margaret Road near Pui Ching Road",
    approximate: true,
    sourceName: "OpenStreetMap road context",
    sourceUrl:
      "https://www.openstreetmap.org/search?query=Princess%20Margaret%20Road%20Pui%20Ching%20Road%20Hong%20Kong",
  },
};
