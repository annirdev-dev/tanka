export interface LatLng {
  lat: number;
  lng: number;
}

export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Running distance (km) from the route start to each polyline vertex, so the
// last entry is the total route length. Index-aligned with `polyline`.
export function cumulativeDistances(polyline: LatLng[]): number[] {
  const out: number[] = [0];
  for (let i = 1; i < polyline.length; i++) {
    out.push(out[i - 1] + distanceKm(polyline[i - 1], polyline[i]));
  }
  return out;
}

// Local flat-earth projection around `anchor` — accurate to well under a
// percent over the tens-of-km spans this is used for, and far cheaper than
// per-segment geodesics.
function planar(anchor: LatLng) {
  const kmPerDegLat = 111.32;
  const kmPerDegLng = 111.32 * Math.cos((anchor.lat * Math.PI) / 180);
  return (p: LatLng) => ({
    x: (p.lng - anchor.lng) * kmPerDegLng,
    y: (p.lat - anchor.lat) * kmPerDegLat,
  });
}

// Closest approach of `point` to the whole polyline: the perpendicular
// distance to the nearest segment, plus how far along the route (km from the
// start) that nearest spot is — used to keep only stations near the real road
// and to list them in the order you'd actually drive past them.
export function closestOnPolyline(
  polyline: LatLng[],
  cumDists: number[],
  point: LatLng
): { distanceKm: number; positionKm: number } {
  const toXY = planar(point);
  const p = toXY(point);

  let best = { distanceKm: Infinity, positionKm: 0 };
  for (let i = 1; i < polyline.length; i++) {
    const a = toXY(polyline[i - 1]);
    const b = toXY(polyline[i]);
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const lenSq = abx * abx + aby * aby;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq));
    const cx = a.x + t * abx;
    const cy = a.y + t * aby;
    const dist = Math.hypot(p.x - cx, p.y - cy);
    if (dist < best.distanceKm) {
      const segLen = cumDists[i] - cumDists[i - 1];
      best = { distanceKm: dist, positionKm: cumDists[i - 1] + t * segLen };
    }
  }
  return best;
}

// Evenly spaced query points along the route, skipping the first
// `startOffsetKm` and last `endOffsetKm` so results are stations you pass on
// the way — not the dense cluster right around where you start or finish.
export function sampleAlongPolyline(
  polyline: LatLng[],
  cumDists: number[],
  opts: { count: number; startOffsetKm?: number; endOffsetKm?: number }
): LatLng[] {
  const total = cumDists[cumDists.length - 1];
  if (total === 0 || polyline.length < 2) return [];

  const startOffsetKm = Math.min(opts.startOffsetKm ?? 0, total / 2);
  const endOffsetKm = Math.min(opts.endOffsetKm ?? 0, total / 2);
  const from = startOffsetKm;
  const to = total - endOffsetKm;
  const span = Math.max(to - from, 0);
  const count = Math.max(1, opts.count);

  const pointAt = (targetKm: number): LatLng => {
    for (let i = 1; i < cumDists.length; i++) {
      if (cumDists[i] >= targetKm) {
        const segLen = cumDists[i] - cumDists[i - 1] || 1;
        const t = (targetKm - cumDists[i - 1]) / segLen;
        return {
          lat: polyline[i - 1].lat + (polyline[i].lat - polyline[i - 1].lat) * t,
          lng: polyline[i - 1].lng + (polyline[i].lng - polyline[i - 1].lng) * t,
        };
      }
    }
    return polyline[polyline.length - 1];
  };

  const points: LatLng[] = [];
  for (let i = 0; i < count; i++) {
    const frac = count === 1 ? 0.5 : i / (count - 1);
    points.push(pointAt(from + span * frac));
  }
  return points;
}
