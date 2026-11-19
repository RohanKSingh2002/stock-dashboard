import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus, X } from 'lucide-react'
import type { Quote, WatchItem } from '../types'
import { price } from '../format'
import Change from './Change'
import Skeleton from './Skeleton'
import Sparkline from './Sparkline'

interface Props {
  items: WatchItem[]
  quotes: Record<string, Quote>
  selected: string
  onSelect: (symbol: string) => void
  onRemove: (symbol: string) => void
  onAdd: () => void
}

export default function Watchlist({ items, quotes, selected, onSelect, onRemove, onAdd }: Props) {
  // Remember the last price shown per symbol so a new tick can flash up or down.
  const last = useRef<Record<string, number>>({})
  useEffect(() => {
    for (const it of items) {
      const q = quotes[it.symbol]
      if (q && !q.error) last.current[it.symbol] = q.price
    }
  })

  return (
    <aside className="rail" aria-label="Watchlist">
      <header className="rail-head">
        <h2>
          Watchlist <span className="muted num">{items.length}</span>
        </h2>
        <button type="button" className="icon-btn" onClick={onAdd} aria-label="Add a stock to the watchlist" title="Add a stock">
          <Plus size={18} />
        </button>
      </header>

      {!items.length ? (
        <div className="rail-empty">
          <p>Your watchlist is empty.</p>
          <button type="button" className="btn" onClick={onAdd}>
            <Plus size={16} aria-hidden="true" />
            Add a stock
          </button>
        </div>
      ) : (
        <ul className="watch">
          <AnimatePresence initial={false} mode="popLayout">
            {items.map((it) => {
              const q = quotes[it.symbol]
              const ok = q && !q.error
              const prev = last.current[it.symbol]
              const dir = ok && prev != null && q.price !== prev ? (q.price > prev ? 'up' : 'down') : ''
              const on = it.symbol === selected
              return (
                <motion.li
                  key={it.symbol}
                  layout="position"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ type: 'spring', stiffness: 480, damping: 40 }}
                  className={on ? 'row on' : 'row'}
                >
                  <button type="button" className="row-main" onClick={() => onSelect(it.symbol)} aria-current={on || undefined}>
                    <span className="row-id">
                      <strong>{it.symbol}</strong>
                      <small>{it.name}</small>
                    </span>
                    <Sparkline values={ok ? q.spark : undefined} up={ok ? q.change >= 0 : true} baseline={ok ? q.prevClose : undefined} />
                    <span className="row-px">
                      {ok ? (
                        <>
                          <span key={q.price} className={`num px ${dir && `flash-${dir}`}`}>
                            {price(q.price)}
                          </span>
                          <Change pct={q.changePct} />
                        </>
                      ) : q?.error ? (
                        <span className="muted small" title={q.error}>
                          No data
                        </span>
                      ) : (
                        <>
                          <Skeleton w={56} h={13} />
                          <Skeleton w={48} h={18} r={6} />
                        </>
                      )}
                    </span>
                  </button>
                  <button type="button" className="row-x icon-btn sm" onClick={() => onRemove(it.symbol)} aria-label={`Remove ${it.symbol} from watchlist`} title="Remove">
                    <X size={14} />
                  </button>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}
      <p className="rail-note">Prices from Yahoo Finance, refreshed every few seconds. They may be delayed.</p>
    </aside>
  )
}
