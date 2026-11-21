export function formatINR(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

export function formatQty(value: number, unit: string): string {
  const rounded =
    unit === 'piece'
      ? Math.round(value * 10) / 10
      : value >= 100
        ? Math.round(value)
        : Math.round(value * 10) / 10;
  return `${rounded} ${unit}`;
}

export function todayISO(date = new Date()): string {
  return toISODate(date);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function isValidISODate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function addDays(iso: string, days: number): string {
  const date = fromISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function startOfWeek(iso: string): string {
  const date = fromISODate(iso);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return toISODate(date);
}

export function formatDay(iso: string, opts: 'short' | 'long' = 'short'): string {
  const date = fromISODate(iso);
  return date.toLocaleDateString('en-IN', {
    weekday: opts === 'long' ? 'long' : 'short',
    day: 'numeric',
    month: opts === 'long' ? 'long' : 'short',
  });
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function currentSeason(date = new Date()): 'summer' | 'monsoon' | 'winter' {
  const month = date.getMonth() + 1;
  if ([6, 7, 8, 9].includes(month)) return 'monsoon';
  if ([11, 12, 1, 2].includes(month)) return 'winter';
  return 'summer';
}

export function seasonLabel(season: string): string {
  if (season === 'monsoon') return 'Monsoon picks';
  if (season === 'winter') return 'Winter warmers';
  if (season === 'summer') return 'Summer coolers';
  return 'All-season favourites';
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function isValidPincode(value: string): boolean {
  return /^[1-9][0-9]{5}$/.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  return /^[6-9][0-9]{9}$/.test(value.replace(/\D/g, '').slice(-10));
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export function pluralize(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}
