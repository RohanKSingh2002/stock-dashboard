import { Star, TrendingDown, TrendingUp } from 'lucide-react'
import { INDICES } from '../constants'
import { signed } from '../format'
import type { Info } from '../types'
import AnimatedPrice from './AnimatedPrice'
import Skeleton from './Skeleton'

interface Props {
  symbol: string
  name?: string
  info: Info | null
  price?: number
  currency?: string
  change: { abs: number; pct: number } | null
  changeLabel: string
  watched: boolean
  onToggleWatch: () => void
  error?: string
}

export default function QuoteHeader({ symbol, name, info, price, currency, change, changeLabel, watched, onToggleWatch, error }: Props) {
  const index = INDICES.find((i) => i.symbol === symbol)
  const title = index ? index.name : symbol
  const subtitle = index ? symbol : (info?.name ?? name)
  const up = (change?.abs ?? 0) >= 0
  const tags = [info?.exchange, info?.sector].filter(Boolean) as string[]

  return (
    <section className="quote" aria-label={`${title} quote`}>
      <div className="quote-top">
        <div className="quote-id">
          <h1 className="sym">{title}</h1>
          {subtitle ? <p className="quote-name">{subtitle}</p> : <Skeleton w={140} h={14} />}
        </div>
        {!index && (
          <button type="button" className={watched ? 'btn ghost on' : 'btn ghost'} aria-pressed={watched} onClick={onToggleWatch}>
            <Star size={16} aria-hidden="true" fill={watched ? 'currentColor' : 'none'} />
            {watched ? 'In watchlist' : 'Add to watchlist'}
          </button>
        )}
      </div>
      {tags.length > 0 && (
        <ul className="tags" aria-label="Classification">
          {tags.map((t) => (
            <li key={t} className="tag">
              {t}
            </li>
          ))}
        </ul>
      )}
      <div className="quote-px">
        {price != null ? (
          <>
            <AnimatedPrice value={price} />
            {!symbol.startsWith('^') && <span className="ccy">{currency ?? info?.currency ?? 'USD'}</span>}
          </>
        ) : error ? (
          <p className="muted">Live price unavailable: {error}</p>
        ) : (
          <Skeleton w={220} h={52} r={8} />
        )}
      </div>
      {change && (
        <p className={`quote-chg ${up ? 'up' : 'down'}`}>
          {up ? <TrendingUp size={18} aria-hidden="true" /> : <TrendingDown size={18} aria-hidden="true" />}
          <span className="num">
            {signed(change.abs)} ({signed(change.pct)}%)
          </span>
          <span className="muted">{changeLabel}</span>
        </p>
      )}
    </section>
  )
}
