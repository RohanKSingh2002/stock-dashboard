import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Plus, Search } from 'lucide-react'
import { api } from '../api'
import { INDICES } from '../constants'
import type { SearchHit, WatchItem } from '../types'

interface Props {
  open: boolean
  /** The search bar the panel opens over; its input lands exactly where the bar is. */
  anchor: RefObject<HTMLElement | null>
  onClose: () => void
  watchlist: WatchItem[]
  onOpen: (hit: SearchHit) => void
  onToggleWatch: (hit: SearchHit) => void
}

interface Row {
  hit: SearchHit
  group: string
}

export default function CommandPalette({ open, anchor, onClose, watchlist, onOpen, onToggleWatch }: Props) {
  const [box, setBox] = useState<CSSProperties>({})
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Place the panel over the search bar, keeping it inside the viewport.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = anchor.current?.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      if (!r || r.bottom < 0 || r.top > vh) {
        setBox({ top: 12, left: 12, width: vw - 24, maxHeight: vh - 24, ['--bar-h' as string]: '44px' })
        return
      }
      const width = Math.min(Math.max(r.width, 400), vw - r.left - 12)
      setBox({ top: r.top, left: r.left, width, maxHeight: Math.min(520, vh - r.top - 16), ['--bar-h' as string]: `${r.height}px` })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, anchor])

  useEffect(() => {
    if (!open) return
    setQ('')
    setHits([])
    setActive(0)
    const previous = document.activeElement as HTMLElement | null
    return () => previous?.focus?.()
  }, [open])

  useEffect(() => {
    const term = q.trim()
    if (!term) {
      setStatus('idle')
      return
    }
    let dead = false
    setStatus('loading')
    const t = window.setTimeout(() => {
      api
        .search(term)
        .then((r) => {
          if (dead) return
          setHits(r)
          setActive(0)
          setStatus('idle')
        })
        .catch((e: Error) => {
          if (dead) return
          setError(e.message)
          setStatus('error')
        })
    }, 220)
    return () => {
      dead = true
      window.clearTimeout(t)
    }
  }, [q])

  const rows: Row[] = useMemo(() => {
    if (q.trim()) return hits.map((hit) => ({ hit, group: 'Results' }))
    return [
      ...watchlist.map((w) => ({ hit: { symbol: w.symbol, name: w.name, exchange: '', type: '' }, group: 'Watchlist' })),
      ...INDICES.map((i) => ({ hit: { symbol: i.symbol, name: i.name, exchange: '', type: 'INDEX' }, group: 'Markets' })),
    ]
  }, [q, hits, watchlist])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const inWatch = (s: string) => watchlist.some((w) => w.symbol === s)
  const choose = (hit: SearchHit) => {
    onOpen(hit)
    onClose()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, rows.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && e.target === input.current) {
      e.preventDefault()
      const row = rows[active]
      if (row) choose(row.hit)
      else if (q.trim()) choose({ symbol: q.trim().toUpperCase(), name: q.trim().toUpperCase(), exchange: '', type: '' })
    } else if (e.key === 'Tab') {
      // Keep focus inside the dialog.
      const items = dialog.current?.querySelectorAll<HTMLElement>('input, button')
      if (!items?.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  const term = q.trim()
  let lastGroup = ''
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="palette-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          onMouseDown={onClose}
        >
          <motion.div
            ref={dialog}
            className="palette"
            role="dialog"
            aria-modal="true"
            aria-label="Search stocks, ETFs and indices"
            style={box}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14, ease: [0.2, 0.8, 0.2, 1] }}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={onKeyDown}
          >
            <div className="palette-input">
              <Search size={16} aria-hidden="true" />
              <input
                ref={input}
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by company or ticker"
                aria-label="Search by company or ticker"
                role="combobox"
                aria-expanded={rows.length > 0}
                aria-controls="palette-list"
                aria-activedescendant={rows[active] ? `opt-${active}` : undefined}
                autoComplete="off"
                spellCheck={false}
              />
              <kbd>Esc</kbd>
            </div>
            <ul id="palette-list" ref={listRef} role="listbox" className="palette-list">
              {rows.map((row, i) => {
                const header = row.group !== lastGroup ? row.group : ''
                lastGroup = row.group
                const watched = inWatch(row.hit.symbol)
                const isIndex = INDICES.some((x) => x.symbol === row.hit.symbol)
                return (
                  <li key={`${row.group}-${row.hit.symbol}`} role="presentation">
                    {header && <p className="palette-group">{header}</p>}
                    <div
                      id={`opt-${i}`}
                      role="option"
                      aria-selected={i === active}
                      data-index={i}
                      className={i === active ? 'opt active' : 'opt'}
                      onMouseMove={() => setActive(i)}
                      onClick={() => choose(row.hit)}
                    >
                      <span className="opt-sym">{isIndex ? row.hit.name : row.hit.symbol}</span>
                      <span className="opt-name">{isIndex ? row.hit.symbol : row.hit.name}</span>
                      {row.hit.exchange && <span className="tag">{row.hit.exchange}</span>}
                      {!isIndex && (
                        <button
                          type="button"
                          className={watched ? 'icon-btn sm on' : 'icon-btn sm'}
                          aria-label={watched ? `Remove ${row.hit.symbol} from watchlist` : `Add ${row.hit.symbol} to watchlist`}
                          title={watched ? 'In watchlist' : 'Add to watchlist'}
                          onClick={(e) => {
                            e.stopPropagation()
                            onToggleWatch(row.hit)
                          }}
                        >
                          {watched ? <Check size={15} /> : <Plus size={15} />}
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
            {term && status === 'idle' && rows.length === 0 && (
              <p className="palette-note">No matches for “{term}”. Press Enter to open {term.toUpperCase()} as a ticker.</p>
            )}
            {status === 'loading' && rows.length === 0 && <p className="palette-note">Searching…</p>}
            {status === 'error' && <p className="palette-note">Search failed: {error}</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
