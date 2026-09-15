// Approximate lat/lng per province/state code, for the LOKI Intelligence
// province map. One point per region - never per city, contacts.ville is
// free text and isn't geocodable (confirmed before building this). Each
// coordinate is that region's capital, except ON/BC/CA which use the
// larger metro (Toronto/Vancouver) instead of the administrative capital -
// more representative of where contacts actually cluster.
//
// Covers every code seen in production that isn't ambiguous. Left out on
// purpose, same "don't guess" principle as the rate_percent/owner_id
// migrations:
//   - "US" - too generic, no specific state
//   - "NS/PE" - two provinces combined in one field, can't split without
//     guessing which contact is which
// A code with no entry here is silently excluded from the map rather than
// plotted somewhere wrong.
export interface RegionCoord {
  label: string;
  lat: number;
  lng: number;
}

export const REGION_COORDS: Record<string, RegionCoord> = {
  QC: { label: "Québec", lat: 46.81, lng: -71.21 },
  ON: { label: "Ontario", lat: 43.65, lng: -79.38 },
  BC: { label: "Colombie-Britannique", lat: 49.28, lng: -123.12 },
  AB: { label: "Alberta", lat: 53.55, lng: -113.49 },
  SK: { label: "Saskatchewan", lat: 50.45, lng: -104.62 },
  MB: { label: "Manitoba", lat: 49.9, lng: -97.14 },
  MI: { label: "Michigan", lat: 42.73, lng: -84.56 },
  NB: { label: "Nouveau-Brunswick", lat: 45.96, lng: -66.64 },
  NL: { label: "Terre-Neuve-et-Labrador", lat: 47.56, lng: -52.71 },
  NS: { label: "Nouvelle-Écosse", lat: 44.65, lng: -63.58 },
  FL: { label: "Florida", lat: 30.44, lng: -84.28 },
  CA: { label: "California", lat: 38.58, lng: -121.49 },
  TN: { label: "Tennessee", lat: 36.16, lng: -86.78 },
  GA: { label: "Georgia", lat: 33.75, lng: -84.39 },
  IL: { label: "Illinois", lat: 39.78, lng: -89.65 },
  NY: { label: "New York", lat: 42.65, lng: -73.76 },
  TX: { label: "Texas", lat: 30.27, lng: -97.74 },
  NC: { label: "North Carolina", lat: 35.78, lng: -78.64 },
  NJ: { label: "New Jersey", lat: 40.22, lng: -74.76 },
  OH: { label: "Ohio", lat: 39.96, lng: -82.99 },
  PA: { label: "Pennsylvania", lat: 40.27, lng: -76.89 },
  VA: { label: "Virginia", lat: 37.54, lng: -77.44 },
  WA: { label: "Washington", lat: 47.04, lng: -122.9 },
  WI: { label: "Wisconsin", lat: 43.07, lng: -89.4 },
  DC: { label: "Washington D.C.", lat: 38.91, lng: -77.04 },
  HI: { label: "Hawaii", lat: 21.31, lng: -157.86 },
  IN: { label: "Indiana", lat: 39.77, lng: -86.16 },
  KS: { label: "Kansas", lat: 39.05, lng: -95.68 },
  MN: { label: "Minnesota", lat: 44.95, lng: -93.09 },
  MS: { label: "Mississippi", lat: 32.3, lng: -90.18 },
  NE: { label: "Nebraska", lat: 40.81, lng: -96.7 },
  RI: { label: "Rhode Island", lat: 41.82, lng: -71.41 },
  AL: { label: "Alabama", lat: 32.38, lng: -86.31 },
};

/** Strips anything but letters and uppercases, so a stray character (e.g. the "`NB" typo seen in production) resolves to the same key as the clean code, without a separate lookup entry. */
export function normalizeRegionCode(raw: string): string {
  return raw.replace(/[^a-zA-Z]/g, "").toUpperCase();
}

/**
 * Square-root radius scale so a bubble's AREA (not radius) is proportional
 * to its count - a linear radius would visually exaggerate the largest
 * regions. Standard proportional-symbol map convention. Clamped to
 * [minRadius, maxRadius].
 */
export function bubbleRadius(count: number, maxCount: number, minRadius = 6, maxRadius = 28): number {
  if (maxCount <= 0) return minRadius;
  const t = Math.sqrt(count / maxCount);
  return minRadius + t * (maxRadius - minRadius);
}
