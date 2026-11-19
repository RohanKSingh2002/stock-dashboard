import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LastPriceAnimationMode,
  LineSeries,
  LineStyle,
  createChart,
  type ISeriesApi,
  type SeriesType,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { Bar, ChartKind, Indicators, RangeKey } from '../types'
import { ema, macd, rsi, sma, type Series } from '../indicators'
import { compact, price } from '../format'

interface Props {
  bars: Bar[]
  kind: ChartKind
  indicators: Indicators
  range: RangeKey
  theme: string
  /** Latest live price, folded into the final bar. */
  livePrice?: number
  /** Dotted reference line, e.g. the previous close on the 1-day view. */
  baseline?: number
  /** Direction for the selected range; colours the area and line views. */
  up: boolean
}

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()
const palette = () => ({
  text: css('--text'),
  muted: css('--muted'),
  line: css('--line'),
  grid: css('--grid'),
  raised: css('--raised'),
  canvas: css('--canvas'),
  up: css('--up'),
  down: css('--down'),
  ind1: css('--ind-1'),
  ind2: css('--ind-2'),
})

export default function Chart({ bars, kind, indicators, range, theme, livePrice, baseline, up }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const mainSeries = useRef<ISeriesApi<SeriesType> | null>(null)
  const lastBar = useRef<Bar | null>(null)
  const [hover, setHover] = useState<Bar | null>(null)

  const intraday = range === '1D' || range === '5D' || range === '1M'
  // The chart renders timestamps as UTC; shift intraday bars so the axis shows local time.
  const tzShift = useMemo(() => -new Date().getTimezoneOffset() * 60, [])
  const toTime = (t: number | string): Time => (typeof t === 'string' ? t : ((t + tzShift) as UTCTimestamp))

  useEffect(() => {
    const el = host.current
    if (!el || !bars.length) return
    const c = palette()
    const hasVolume = indicators.volume
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: c.muted,
        fontFamily: "'Geist Variable', system-ui, sans-serif",
        fontSize: 12,
        panes: { separatorColor: c.line, separatorHoverColor: c.line, enableResize: false },
      },
      localization: { priceFormatter: price },
      grid: { vertLines: { visible: false }, horzLines: { color: c.grid } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: hasVolume ? 0.2 : 0.06 } },
      timeScale: { borderVisible: false, timeVisible: intraday, secondsVisible: false, rightOffset: 3 },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: c.muted, style: LineStyle.Dashed, width: 1, labelBackgroundColor: c.raised },
        horzLine: { color: c.muted, style: LineStyle.Dashed, width: 1, labelBackgroundColor: c.raised },
      },
      handleScale: { axisPressedMouseMove: { time: true, price: false } },
    })

    const times = bars.map((b) => toTime(b.time))
    const closes = bars.map((b) => b.close)
    const line = (s: Series) => s.flatMap((v, i) => (v == null ? [] : [{ time: times[i], value: v }]))
    const quiet = { priceLineVisible: false, lastValueVisible: false }

    let main: ISeriesApi<SeriesType>
    if (kind === 'candles') {
      const s = chart.addSeries(CandlestickSeries, {
        upColor: c.up, downColor: c.down, borderVisible: false, wickUpColor: c.up, wickDownColor: c.down, priceLineVisible: false,
      })
      s.setData(bars.map((b, i) => ({ time: times[i], open: b.open, high: b.high, low: b.low, close: b.close })))
      main = s
    } else if (kind === 'area') {
      const s = chart.addSeries(AreaSeries, {
        lineWidth: 2,
        priceLineVisible: false,
        lastPriceAnimation: LastPriceAnimationMode.OnDataUpdate,
        crosshairMarkerRadius: 5,
        crosshairMarkerBorderColor: c.canvas,
        crosshairMarkerBorderWidth: 2,
      })
      s.setData(bars.map((b, i) => ({ time: times[i], value: b.close })))
      main = s
    } else {
      const s = chart.addSeries(LineSeries, {
        lineWidth: 2,
        priceLineVisible: false,
        lastPriceAnimation: LastPriceAnimationMode.OnDataUpdate,
        crosshairMarkerRadius: 5,
        crosshairMarkerBorderColor: c.canvas,
        crosshairMarkerBorderWidth: 2,
      })
      s.setData(bars.map((b, i) => ({ time: times[i], value: b.close })))
      main = s
    }
    mainSeries.current = main
    lastBar.current = bars[bars.length - 1]

    if (hasVolume) {
      const v = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: '', ...quiet })
      v.priceScale().applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } })
      v.setData(bars.map((b, i) => ({ time: times[i], value: b.volume, color: (b.close >= b.open ? c.up : c.down) + '33' })))
    }
    if (indicators.sma) chart.addSeries(LineSeries, { color: c.ind1, lineWidth: 2, ...quiet }).setData(line(sma(closes, 20)))
    if (indicators.ema) chart.addSeries(LineSeries, { color: c.ind2, lineWidth: 2, ...quiet }).setData(line(ema(closes, 50)))

    let pane = 1
    if (indicators.rsi) {
      const r = chart.addSeries(LineSeries, { color: c.ind1, lineWidth: 2, priceLineVisible: false }, pane++)
      r.setData(line(rsi(closes, 14)))
      for (const level of [70, 30]) {
        r.createPriceLine({ price: level, color: c.muted, lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: '' })
      }
    }
    if (indicators.macd) {
      const m = macd(closes)
      chart
        .addSeries(HistogramSeries, quiet, pane)
        .setData(m.hist.flatMap((v, i) => (v == null ? [] : [{ time: times[i], value: v, color: (v >= 0 ? c.up : c.down) + '8C' }])))
      chart.addSeries(LineSeries, { color: c.ind1, lineWidth: 2, ...quiet }, pane).setData(line(m.line))
      chart.addSeries(LineSeries, { color: c.ind2, lineWidth: 1, ...quiet }, pane).setData(line(m.signal))
    }
    const panes = chart.panes()
    panes[0]?.setStretchFactor(3.2)
    for (let i = 1; i < panes.length; i++) panes[i].setStretchFactor(1)

    const byTime = new Map<string, Bar>()
    bars.forEach((b, i) => byTime.set(String(times[i]), b))
    chart.subscribeCrosshairMove((p) => setHover(p.time ? (byTime.get(String(p.time)) ?? null) : null))
    chart.timeScale().fitContent()

    return () => {
      mainSeries.current = null
      chart.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, kind, indicators, intraday, theme])

  // Direction colour for line and area views, applied without rebuilding the chart.
  useEffect(() => {
    const s = mainSeries.current
    if (!s || kind === 'candles') return
    const c = palette()
    const col = up ? c.up : c.down
    if (kind === 'area') s.applyOptions({ lineColor: col, topColor: col + '3D', bottomColor: col + '00' })
    else s.applyOptions({ color: col })
  }, [up, kind, bars, indicators, theme])

  // Reference line (previous close on the 1-day view).
  useEffect(() => {
    const s = mainSeries.current
    if (!s || baseline == null) return
    const pl = s.createPriceLine({
      price: baseline,
      color: palette().muted,
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: false,
      title: 'Prev close',
    })
    return () => {
      // If the chart was rebuilt, this series is already gone with it; touching it would
      // schedule a redraw on a disposed chart.
      if (mainSeries.current === s) s.removePriceLine(pl)
    }
  }, [baseline, kind, bars, indicators, theme])

  // Live tick: fold the latest price into the final bar.
  useEffect(() => {
    const s = mainSeries.current
    const lb = lastBar.current
    if (!s || !lb || livePrice == null) return
    const next: Bar = { ...lb, high: Math.max(lb.high, livePrice), low: Math.min(lb.low, livePrice), close: livePrice }
    lastBar.current = next
    const time = toTime(next.time)
    if (kind === 'candles') s.update({ time, open: next.open, high: next.high, low: next.low, close: next.close })
    else s.update({ time, value: next.close })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livePrice])

  const shown = hover ?? lastBar.current ?? bars[bars.length - 1]
  return (
    <div className="chart-wrap">
      {shown && (
        <dl className="legend num" aria-label="Values at the cursor">
          <div><dt>O</dt><dd>{price(shown.open)}</dd></div>
          <div><dt>H</dt><dd>{price(shown.high)}</dd></div>
          <div><dt>L</dt><dd>{price(shown.low)}</dd></div>
          <div><dt>C</dt><dd>{price(shown.close)}</dd></div>
          {shown.volume > 0 && <div><dt>Vol</dt><dd>{compact(shown.volume)}</dd></div>}
        </dl>
      )}
      <div ref={host} className="chart" role="img" aria-label="Price chart" />
    </div>
  )
}
