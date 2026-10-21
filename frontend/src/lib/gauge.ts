// Geometry for the half-circle sentiment gauge. Score 0 sits at the left end
// (180°), 50 at the top (90°), and 100 at the right end (0°).

export type Label = "Strongly bearish" | "Bearish" | "Neutral" | "Bullish" | "Strongly bullish";

export interface Zone {
  from: number;
  to: number;
  label: Label;
  tone: "bear-strong" | "bear" | "neutral" | "bull" | "bull-strong";
}

// Boundaries match backend/app/aggregate.py label_for().
export const ZONES: Zone[] = [
  { from: 0, to: 20, label: "Strongly bearish", tone: "bear-strong" },
  { from: 20, to: 40, label: "Bearish", tone: "bear" },
  { from: 40, to: 60, label: "Neutral", tone: "neutral" },
  { from: 60, to: 80, label: "Bullish", tone: "bull" },
  { from: 80, to: 100, label: "Strongly bullish", tone: "bull-strong" },
];

const clamp = (score: number) => Math.min(100, Math.max(0, score));

export function scoreToAngle(score: number): number {
  return 180 - clamp(score) * 1.8;
}

export function pointAt(score: number, cx: number, cy: number, r: number) {
  const rad = (scoreToAngle(score) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

const fmt = (n: number) => String(Math.round(n * 100) / 100);

export function arcPath(from: number, to: number, cx: number, cy: number, r: number): string {
  const a = pointAt(from, cx, cy, r);
  const b = pointAt(to, cx, cy, r);
  return `M ${fmt(a.x)} ${fmt(a.y)} A ${r} ${r} 0 0 1 ${fmt(b.x)} ${fmt(b.y)}`;
}

/** Degrees to rotate a needle drawn pointing left (at score 0). */
export function needleRotation(score: number): number {
  return clamp(score) * 1.8;
}

export function zoneFor(score: number): Zone {
  if (score < 20) return ZONES[0];
  if (score < 40) return ZONES[1];
  if (score <= 60) return ZONES[2];
  if (score <= 80) return ZONES[3];
  return ZONES[4];
}
