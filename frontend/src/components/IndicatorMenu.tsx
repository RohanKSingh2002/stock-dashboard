import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'
import type { Indicators } from '../types'

const ITEMS: { key: keyof Indicators; label: string; detail: string; swatch?: string }[] = [
  { key: 'volume', label: 'Volume', detail: 'Bars under the price' },
  { key: 'sma', label: 'SMA 20', detail: 'Simple moving average', swatch: 'var(--ind-1)' },
  { key: 'ema', label: 'EMA 50', detail: 'Exponential moving average', swatch: 'var(--ind-2)' },
  { key: 'rsi', label: 'RSI 14', detail: 'Momentum, separate pane' },
  { key: 'macd', label: 'MACD', detail: '12, 26, 9 in a separate pane' },
]

export default function IndicatorMenu({ value, onChange }: { value: Indicators; onChange: (v: Indicators) => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const count = ITEMS.filter((i) => value[i.key]).length

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="menu" ref={root}>
      <button type="button" className="btn ghost" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        <SlidersHorizontal size={16} aria-hidden="true" />
        Indicators
        {count > 0 && <span className="count num">{count}</span>}
        <ChevronDown size={14} aria-hidden="true" className={open ? 'chev open' : 'chev'} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="popover"
            role="group"
            aria-label="Chart indicators"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {ITEMS.map((it) => (
              <label key={it.key} className="check">
                <input type="checkbox" checked={value[it.key]} onChange={() => onChange({ ...value, [it.key]: !value[it.key] })} />
                <span className="box" aria-hidden="true" />
                <span className="check-text">
                  <span>
                    {it.label}
                    {it.swatch && <i className="swatch" style={{ background: it.swatch }} aria-hidden="true" />}
                  </span>
                  <small>{it.detail}</small>
                </span>
              </label>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
