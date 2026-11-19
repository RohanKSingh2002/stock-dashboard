import { INDICES } from '../constants'
import { price } from '../format'
import type { Quote } from '../types'
import Change from './Change'
import Skeleton from './Skeleton'

interface Props {
  quotes: Record<string, Quote>
  selected: string
  onSelect: (symbol: string) => void
}

export default function IndexStrip({ quotes, selected, onSelect }: Props) {
  return (
    <nav className="strip" aria-label="Market indices">
      <ul>
        {INDICES.map((ix) => {
          const q = quotes[ix.symbol]
          const ok = q && !q.error
          return (
            <li key={ix.symbol}>
              <button type="button" className={ix.symbol === selected ? 'on' : undefined} aria-current={ix.symbol === selected || undefined} onClick={() => onSelect(ix.symbol)}>
                <span className="ix-name">{ix.name}</span>
                {ok ? (
                  <>
                    <span className="ix-px num">{price(q.price)}</span>
                    <Change pct={q.changePct} />
                  </>
                ) : q?.error ? (
                  <span className="muted">Unavailable</span>
                ) : (
                  <Skeleton w={96} h={12} />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
