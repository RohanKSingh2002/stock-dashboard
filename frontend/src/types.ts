export interface Quote {
  price: number
  prevClose: number
  change: number
  changePct: number
  currency: string
  spark?: number[]
  error?: string
}
/** Intraday bars use epoch seconds; daily and longer bars use 'YYYY-MM-DD'. */
export interface Bar {
  time: number | string
  open: number
  high: number
  low: number
  close: number
  volume: number
}
export interface WatchItem {
  symbol: string
  name: string
}
export interface Info {
  name?: string
  shortName?: string
  quoteType?: string
  sector?: string
  industry?: string
  exchange?: string
  currency?: string
  marketCap?: number
  trailingPE?: number
  forwardPE?: number
  dividendYield?: number
  beta?: number
  fiftyTwoWeekHigh?: number
  fiftyTwoWeekLow?: number
  averageVolume?: number
  volume?: number
  open?: number
  dayHigh?: number
  dayLow?: number
  summary?: string
  website?: string
}
export interface NewsItem {
  title: string
  publisher?: string
  url: string
  time: number
  summary?: string
  thumbnail?: string | null
}
export interface SearchHit {
  symbol: string
  name: string
  exchange: string
  type: string
}
export type MarketState = 'open' | 'pre' | 'post' | 'closed'
export type RangeKey = '1D' | '5D' | '1M' | '6M' | '1Y' | '5Y' | 'MAX'
export type ChartKind = 'area' | 'candles' | 'line'
export interface Indicators {
  volume: boolean
  sma: boolean
  ema: boolean
  rsi: boolean
  macd: boolean
}
