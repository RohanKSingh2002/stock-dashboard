import { useEffect, useState } from 'react'
import { api } from '../api'
import { nyTime } from '../format'
import type { MarketState } from '../types'
import type { Connection } from '../useLiveQuotes'

const LABEL: Record<MarketState, string> = {
  open: 'Market open',
  pre: 'Pre-market',
  post: 'After hours',
  closed: 'Market closed',
}

export default function MarketStatus({ connection }: { connection: Connection }) {
  const [state, setState] = useState<MarketState | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const load = () => api.market().then((m) => setState(m.state)).catch(() => undefined)
    load()
    const poll = window.setInterval(load, 60_000)
    const tick = window.setInterval(() => setNow(new Date()), 15_000)
    return () => {
      window.clearInterval(poll)
      window.clearInterval(tick)
    }
  }, [])

  return (
    <div className="market" role="status">
      <span className={`conn ${connection}`} title={connection === 'live' ? 'Prices are updating live' : 'Trying to reconnect to the price feed'}>
        <i aria-hidden="true" />
        {connection === 'live' ? 'Live' : connection === 'connecting' ? 'Connecting' : 'Reconnecting'}
      </span>
      {state && (
        <span className={`session ${state}`}>
          {LABEL[state]}
          <span className="muted num">{nyTime(now)} ET</span>
        </span>
      )}
    </div>
  )
}
