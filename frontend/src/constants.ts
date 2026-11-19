import type { Indicators, RangeKey, WatchItem } from './types'

export const INDICES: WatchItem[] = [
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: '^IXIC', name: 'Nasdaq' },
  { symbol: '^DJI', name: 'Dow Jones' },
  { symbol: '^RUT', name: 'Russell 2000' },
  { symbol: '^VIX', name: 'VIX' },
  { symbol: 'BTC-USD', name: 'Bitcoin' },
]

export const DEFAULT_WATCHLIST: WatchItem[] = [
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'GOOGL', name: 'Alphabet' },
  { symbol: 'AMZN', name: 'Amazon' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'META', name: 'Meta Platforms' },
  { symbol: 'SPY', name: 'S&P 500 ETF' },
]

export const RANGES: RangeKey[] = ['1D', '5D', '1M', '6M', '1Y', '5Y', 'MAX']

export const RANGE_LABEL: Record<RangeKey, string> = {
  '1D': 'today',
  '5D': 'past 5 days',
  '1M': 'past month',
  '6M': 'past 6 months',
  '1Y': 'past year',
  '5Y': 'past 5 years',
  MAX: 'all time',
}

export const DEFAULT_INDICATORS: Indicators = { volume: true, sma: false, ema: false, rsi: false, macd: false }

/** Friendly name for a symbol: index display names first, then a fallback. */
export function displayName(symbol: string, fallback?: string) {
  return INDICES.find((i) => i.symbol === symbol)?.name ?? fallback ?? symbol
}

/** Indices and crypto have no exchange-traded "ticker" look; show their name instead. */
export function displaySymbol(symbol: string) {
  return INDICES.find((i) => i.symbol === symbol)?.name ?? symbol
}
