/** Formatting helpers shared by the table, KPI cards, charts and detail drawer, so
 *  a premium renders identically everywhere it appears. */

const CURRENCY_FRACTION_DIGITS: Record<string, number> = { JPY: 0 };

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: CURRENCY_FRACTION_DIGITS[currency] ?? 0,
  }).format(amount);
}

/** Compact form for KPI tiles and axis labels: $1.2M, $95.7M. */
export function formatCompactCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

/** ISO date (yyyy-MM-dd) -> "12 Sep 2026". Parsed as UTC so a date-only value
 *  never shifts a day backwards in negative-offset timezones. */
export function formatDate(iso: string): string {
  if (!iso) return '—';
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function formatRelativeTime(from: Date, now: Date = new Date()): string {
  const seconds = Math.round((now.getTime() - from.getTime()) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Days until expiry — negative when already expired. */
export function daysUntil(iso: string): number {
  const target = new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime();
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((target - todayUtc) / 86_400_000);
}
