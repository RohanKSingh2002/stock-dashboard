import type { Bar, Info, MarketState, NewsItem, Quote, RangeKey, SearchHit } from './types'

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      if (body?.detail) detail = String(body.detail)
    } catch {
      /* body was not JSON */
    }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

const enc = encodeURIComponent

export const api = {
  health: () => get<{ demo: boolean; pushInterval: number }>('/api/health'),
  market: () => get<{ state: MarketState; source: string }>('/api/market'),
  snapshot: (symbols: string[], spark: string[] = []) =>
    get<Record<string, Quote>>(`/api/snapshot?symbols=${enc(symbols.join(','))}&spark=${enc(spark.join(','))}`),
  history: (symbol: string, range: RangeKey) =>
    get<{ bars: Bar[] }>(`/api/history/${enc(symbol)}?range=${range}`).then((r) => r.bars),
  info: (symbol: string) => get<Info>(`/api/info/${enc(symbol)}`),
  news: (symbol: string) => get<NewsItem[]>(`/api/news/${enc(symbol)}`),
  search: (q: string) => get<SearchHit[]>(`/api/search?q=${enc(q)}`),
}
