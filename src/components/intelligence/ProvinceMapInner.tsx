"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import { bubbleRadius, normalizeRegionCode, REGION_COORDS } from "@/lib/geo";
import { COLORS } from "@/lib/theme";

interface ProvinceMapInnerProps {
  data: { province: string; count: number }[];
}

/**
 * Actual Leaflet map - kept in its own module so the parent can load it via
 * next/dynamic({ ssr: false }). Leaflet touches window/document at import
 * time, which breaks Next's server render pass even inside a "use client"
 * file (that file still renders once on the server for the initial HTML).
 */
export default function ProvinceMapInner({ data }: ProvinceMapInnerProps) {
  const byCode = new Map<string, number>();
  for (const d of data) {
    const code = normalizeRegionCode(d.province);
    if (!REGION_COORDS[code]) continue;
    byCode.set(code, (byCode.get(code) ?? 0) + d.count);
  }
  const points = [...byCode.entries()].map(([code, count]) => ({ code, count, ...REGION_COORDS[code]! }));
  const maxCount = Math.max(1, ...points.map((p) => p.count));

  return (
    <MapContainer
      center={[43, -90]}
      zoom={3}
      scrollWheelZoom={false}
      style={{ height: 380, width: "100%", borderRadius: 12 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((p) => (
        <CircleMarker
          key={p.code}
          center={[p.lat, p.lng]}
          radius={bubbleRadius(p.count, maxCount)}
          pathOptions={{ color: "#00784A", weight: 1.5, fillColor: COLORS.teal, fillOpacity: 0.55 }}
        >
          <Tooltip className="loki-map-tooltip" direction="top" offset={[0, -6]}>
            <span className="text-text font-semibold">{p.label}</span>
            <br />
            <span className="text-orange font-bold">{p.count}</span>{" "}
            <span className="text-textSoft">contact{p.count > 1 ? "s" : ""}</span>
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
