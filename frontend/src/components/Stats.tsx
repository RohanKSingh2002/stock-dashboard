import { useState } from 'react'
import type { Info } from '../types'
import { compact, price } from '../format'
import Skeleton from './Skeleton'

interface Props {
  info: Info | null
  error: string
  last?: number
  prevClose?: number
}

function RangeBar({ label, low, high, value }: { label: string; low: number; high: number; value?: number }) {
  const lo = value != null ? Math.min(low, value) : low
  const hi = value != null ? Math.max(high, value) : high
  const pct = value != null && hi > lo ? ((value - lo) / (hi - lo)) * 100 : null
  return (
    <div className="range">
      <p className="range-label">{label}</p>
      <div className="range-track" role="img" aria-label={`${label}: ${price(lo)} to ${price(hi)}${value != null ? `, now ${price(value)}` : ''}`}>
        {pct != null && (
          <>
            <span className="range-fill" style={{ width: `${pct}%` }} />
            <span className="range-mark" style={{ left: `${pct}%` }} />
          </>
        )}
      </div>
      <p className="range-ends num">
        <span>{price(lo)}</span>
        <span>{price(hi)}</span>
      </p>
    </div>
  )
}

export default function Stats({ info, error, last, prevClose }: Props) {
  const [more, setMore] = useState(false)
  if (error) return <p className="note">Company details are unavailable right now: {error}</p>
  if (!info)
    return (
      <div className="stats-grid" aria-busy="true">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="stat">
            <Skeleton w={70} h={11} />
            <Skeleton w={90} h={16} />
          </div>
        ))}
      </div>
    )

  const cells: [string, number | undefined, (n: number) => string][] = [
    ['Open', info.open, price],
    ['Previous close', prevClose, price],
    ['Volume', info.volume, compact],
    ['Avg. volume', info.averageVolume, compact],
    ['Market cap', info.marketCap, compact],
    ['P/E (TTM)', info.trailingPE, (n) => n.toFixed(2)],
    ['Dividend yield', info.dividendYield, (n) => `${n.toFixed(2)}%`],
    ['Beta', info.beta, (n) => n.toFixed(2)],
  ]
  const shown = cells.filter(([, v]) => v != null)

  return (
    <div>
      {shown.length > 0 && (
        <dl className="stats-grid">
          {shown.map(([k, v, f]) => (
            <div key={k} className="stat">
              <dt>{k}</dt>
              <dd className="num">{f(v as number)}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="ranges">
        {info.dayLow != null && info.dayHigh != null && <RangeBar label="Day range" low={info.dayLow} high={info.dayHigh} value={last} />}
        {info.fiftyTwoWeekLow != null && info.fiftyTwoWeekHigh != null && (
          <RangeBar label="52-week range" low={info.fiftyTwoWeekLow} high={info.fiftyTwoWeekHigh} value={last} />
        )}
      </div>
      {info.summary && (
        <div className="about">
          <h3>About</h3>
          <p className={more ? 'open' : undefined}>{info.summary}</p>
          {info.summary.length > 280 && (
            <button type="button" className="link" onClick={() => setMore((m) => !m)} aria-expanded={more}>
              {more ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
