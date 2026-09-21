export type PriceTier = "cheap" | "mid" | "expensive";

// Ranks a set of prices into thirds so the cheapest third reads as "cheap"
// and the priciest third as "expensive", relative to what's actually on screen.
export function tierForRank(rank: number, total: number): PriceTier {
  if (total <= 1) return "mid";
  const fraction = rank / (total - 1);
  if (fraction <= 1 / 3) return "cheap";
  if (fraction >= 2 / 3) return "expensive";
  return "mid";
}

export function buildPriceRanks(prices: (number | null)[]): Map<number, PriceTier> {
  const indexed = prices
    .map((price, index) => ({ price, index }))
    .filter((entry): entry is { price: number; index: number } => entry.price !== null)
    .sort((a, b) => a.price - b.price);

  const ranks = new Map<number, PriceTier>();
  indexed.forEach((entry, rank) => {
    ranks.set(entry.index, tierForRank(rank, indexed.length));
  });
  return ranks;
}
