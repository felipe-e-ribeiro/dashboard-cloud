export interface ChangeDisplay {
  text: string;
  direction: "up" | "down" | "flat";
}

export function formatChangePct(changePct: number | null, comparisonLabel: string): ChangeDisplay | null {
  if (changePct === null) return null;

  const direction = changePct > 0 ? "up" : changePct < 0 ? "down" : "flat";
  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";

  return {
    text: `${arrow} ${Math.abs(changePct).toFixed(1)}% vs. ${comparisonLabel}`,
    direction,
  };
}
