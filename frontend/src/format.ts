const fmt = (min: number, max = min) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: min, maximumFractionDigits: max })

export const price = (n: number) => (Math.abs(n) >= 1 ? fmt(2) : fmt(4)).format(n)
export const signed = (n: number, d = 2) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(d).format(Math.abs(n))
export const unsigned = (n: number, d = 2) => fmt(d).format(Math.abs(n))
export const compact = (n: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(n)
export const percent = (n: number) => `${fmt(2).format(n * 100)}%`

export function ago(unixSeconds: number): string {
  const s = Math.max(0, Date.now() / 1000 - unixSeconds)
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  return `${Math.round(s / 86400)} d ago`
}

export const nyTime = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }).format(d)
