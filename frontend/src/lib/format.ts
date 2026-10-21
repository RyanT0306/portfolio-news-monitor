export const pct = (fraction: number) => `${Math.round(fraction * 100)}%`;

export const signedPct = (fraction: number) => `${fraction < 0 ? "−" : ""}${Math.abs(Math.round(fraction * 100))}%`;

export function timeAgo(iso: string, now = Date.now()): string {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
