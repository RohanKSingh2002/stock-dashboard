import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AreaChart, CandlestickChart, LineChart, RotateCw } from 'lucide-react'
import { api } from './api'
import { DEFAULT_INDICATORS, DEFAULT_WATCHLIST, INDICES, RANGES, RANGE_LABEL, displayName, displaySymbol } from './constants'
import { price as fmtPrice } from './format'
import { useLiveQuotes } from './useLiveQuotes'
import { useStored } from './useStored'
import type { Bar, ChartKind, Indicators, Info, NewsItem, RangeKey, SearchHit, WatchItem } from './types'
import Chart from './components/Chart'
import CommandPalette from './components/CommandPalette'
import IndexStrip from './components/IndexStrip'
import IndicatorMenu from './components/IndicatorMenu'
import News from './components/News'
import QuoteHeader from './components/QuoteHeader'
import Segmented from './components/Segmented'
import Skeleton from './components/Skeleton'
import Stats from './components/Stats'
import TopBar from './components/TopBar'
import Watchlist from './components/Watchlist'

const isWatchList = (v: unknown) => Array.isArray(v) && v.every((x) => x && typeof x.symbol === 'string' && typeof x.name === 'string')
const KINDS: { value: ChartKind; label: string; icon: React.ReactNode }[] = [
  { value: 'area', label: 'Area', icon: <AreaChart size={15} aria-hidden="true" /> },
  { value: 'candles', label: 'Candles', icon: <CandlestickChart size={15} aria-hidden="true" /> },
  { value: 'line', label: 'Line', icon: <LineChart size={15} aria-hidden="true" /> },
]

export default function App() {
  const [watch, setWatch] = useStored<WatchItem[]>('md:watchlist', DEFAULT_WATCHLIST, isWatchList)
  const [selected, setSelected] = useStored<string>('md:selected', DEFAULT_WATCHLIST[0].symbol, (v) => typeof v === 'string' && v.length > 0)
  const [range, setRange] = useStored<RangeKey>('md:range', '1D', (v) => RANGES.includes(v as RangeKey))
  const [kind, setKind] = useStored<ChartKind>('md:kind', 'area', (v) => v === 'area' || v === 'candles' || v === 'line')
  const [indicators, setIndicators] = useStored<Indicators>('md:indicators', DEFAULT_INDICATORS, (v) => !!v && typeof v === 'object')
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? 'dark')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const searchRef = useRef<HTMLButtonElement>(null)
  const [demo, setDemo] = useState(false)

  const [bars, setBars] = useState<Bar[] | null>(null)
  const [barsError, setBarsError] = useState('')
  const [reload, setReload] = useState(0)
  const [info, setInfo] = useState<Info | null>(null)
  const [infoError, setInfoError] = useState('')
  const [news, setNews] = useState<NewsItem[] | null>(null)
  const [newsError, setNewsError] = useState('')

  const watchSymbols = useMemo(() => watch.map((w) => w.symbol), [watch])
  const subscribed = useMemo(
    () => Array.from(new Set([...watchSymbols, ...INDICES.map((i) => i.symbol), selected])),
    [watchSymbols, selected],
  )
  const { quotes, connection } = useLiveQuotes(subscribed, watchSymbols)
  const q = quotes[selected]
  const quoteOk = !!q && !q.error
  const watched = watchSymbols.includes(selected)

  useEffect(() => {
    api.health().then((h) => setDemo(h.demo)).catch(() => undefined)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName)
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Price history; the 1-day view refetches each minute so new bars appear.
  useEffect(() => {
    let dead = false
    setBars(null)
    setBarsError('')
    const load = (initial: boolean) =>
      api
        .history(selected, range)
        .then((b) => !dead && setBars((prev) => (!initial && prev && prev.length === b.length ? prev : b)))
        .catch((e: Error) => !dead && initial && setBarsError(e.message))
    load(true)
    const t = range === '1D' ? window.setInterval(() => load(false), 60_000) : 0
    return () => {
      dead = true
      window.clearInterval(t)
    }
  }, [selected, range, reload])

  useEffect(() => {
    let dead = false
    setInfo(null)
    setInfoError('')
    setNews(null)
    setNewsError('')
    api.info(selected).then((i) => !dead && setInfo(i)).catch((e: Error) => !dead && setInfoError(e.message))
    api.news(selected).then((n) => !dead && setNews(n)).catch((e: Error) => !dead && setNewsError(e.message))
    return () => {
      dead = true
    }
  }, [selected])

  const livePrice = quoteOk ? q.price : undefined
  const shownPrice = livePrice ?? (bars?.length ? bars[bars.length - 1].close : undefined)

  // Change for the selected range: today's move against the previous close, or since the first bar.
  const change = useMemo(() => {
    if (range === '1D' && quoteOk) return { abs: q.change, pct: q.changePct }
    if (!bars?.length || shownPrice == null) return null
    const base = range === '1D' ? bars[0].open : bars[0].close
    return { abs: shownPrice - base, pct: base ? ((shownPrice - base) / base) * 100 : 0 }
  }, [range, quoteOk, q, bars, shownPrice])
  const up = (change?.abs ?? 0) >= 0

  useEffect(() => {
    document.title = shownPrice != null ? `${displaySymbol(selected)} ${fmtPrice(shownPrice)} - Market Desk` : 'Market Desk'
  }, [selected, shownPrice])

  const open = useCallback((hit: SearchHit) => setSelected(hit.symbol), [setSelected])
  const toggleWatch = (symbol: string, name: string) =>
    setWatch((w) => (w.some((x) => x.symbol === symbol) ? w.filter((x) => x.symbol !== symbol) : [...w, { symbol, name }]))
  const meta = watch.find((w) => w.symbol === selected)
  const name = meta?.name ?? displayName(selected, info?.shortName ?? info?.name)

  return (
    <div className="app">
      <TopBar searchRef={searchRef} onSearch={() => setPaletteOpen(true)} theme={theme} onTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} demo={demo} connection={connection} />
      <IndexStrip quotes={quotes} selected={selected} onSelect={setSelected} />

      <main className="main" id="main">
        <QuoteHeader
          symbol={selected}
          name={name}
          info={info}
          price={shownPrice}
          currency={q?.currency}
          change={change}
          changeLabel={RANGE_LABEL[range]}
          watched={watched}
          onToggleWatch={() => toggleWatch(selected, info?.shortName ?? name)}
          error={q?.error}
        />

        <div className="toolbar">
          <Segmented id="range" label="Time range" options={RANGES.map((r) => ({ value: r, label: r }))} value={range} onChange={setRange} />
          <div className="toolbar-end">
            <Segmented id="kind" label="Chart type" options={KINDS} value={kind} onChange={setKind} />
            <IndicatorMenu value={indicators} onChange={setIndicators} />
          </div>
        </div>

        <section className="chart-area" aria-label="Price chart">
          {barsError ? (
            <div className="chart-msg">
              <p>Couldn’t load the {RANGE_LABEL[range]} chart for {displaySymbol(selected)}.</p>
              <p className="muted small">{barsError}</p>
              <button type="button" className="btn" onClick={() => setReload((n) => n + 1)}>
                <RotateCw size={15} aria-hidden="true" />
                Try again
              </button>
            </div>
          ) : !bars ? (
            <Skeleton h="100%" r={10} style={{ display: 'block' }} />
          ) : (
            <Chart
              bars={bars}
              kind={kind}
              indicators={indicators}
              range={range}
              theme={theme}
              livePrice={livePrice}
              baseline={range === '1D' && quoteOk ? q.prevClose : undefined}
              up={up}
            />
          )}
        </section>

        <div className="details">
          <section aria-labelledby="stats-h">
            <h2 id="stats-h">Key statistics</h2>
            <Stats info={info} error={infoError} last={shownPrice} prevClose={quoteOk ? q.prevClose : undefined} />
          </section>
          <section aria-labelledby="news-h">
            <h2 id="news-h">Latest news</h2>
            <News items={news} error={newsError} />
          </section>
        </div>
      </main>

      <Watchlist
        items={watch}
        quotes={quotes}
        selected={selected}
        onSelect={setSelected}
        onRemove={(s) => setWatch((w) => w.filter((x) => x.symbol !== s))}
        onAdd={() => setPaletteOpen(true)}
      />

      <CommandPalette
        open={paletteOpen}
        anchor={searchRef}
        onClose={() => setPaletteOpen(false)}
        watchlist={watch}
        onOpen={open}
        onToggleWatch={(hit) => toggleWatch(hit.symbol, hit.name)}
      />
    </div>
  )
}
