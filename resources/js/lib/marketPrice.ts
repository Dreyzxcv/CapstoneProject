export interface MarketPriceEntry {
    species: string;
    year: number;
    month: number; // 0 = whole year
    price_per_bd_ft: string | number;
}
export type RatePeriod = { year: number; month: number };
export type RateScope = 'month' | 'year';
export interface ResolvedRate { price: number; scope: RateScope }

export const MONTH_NAMES = [
    'Whole Year', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const key = (species: string, year: number, month: number) => `${species}|${year}|${month}`;

export function buildRateMap(entries: MarketPriceEntry[]): Record<string, number> {
    const map: Record<string, number> = {};
    entries.forEach((e) => { map[key(e.species, Number(e.year), Number(e.month))] = Number(e.price_per_bd_ft); });
    return map;
}

// Parses YYYY-MM-DD without Date(), avoiding timezone shifts at month/year edges.
export function periodFromDate(date: string): RatePeriod | null {
    const m = /^(\d{4})-(\d{2})-\d{2}/.exec(date);
    if (!m) return null;
    const month = Number(m[2]);
    return month >= 1 && month <= 12 ? { year: Number(m[1]), month } : null;
}

export function resolveRate(
    map: Record<string, number>, species: string, period: RatePeriod | null,
): ResolvedRate | null {
    if (!species || !period) return null;
    const monthly = map[key(species, period.year, period.month)];
    if (monthly !== undefined) return { price: monthly, scope: 'month' };
    const yearly = map[key(species, period.year, 0)];
    if (yearly !== undefined) return { price: yearly, scope: 'year' };
    return null;
}