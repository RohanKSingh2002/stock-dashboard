import { signed } from '../format'

/** Percentage change as a tinted badge. Colour is never the only cue: the sign is always shown. */
export default function Change({ pct, size = 'sm' }: { pct: number; size?: 'sm' | 'md' }) {
  const r = Math.round(pct * 100) / 100
  const dir = r > 0 ? 'up' : r < 0 ? 'down' : 'flat'
  return <span className={`badge ${dir} ${size}`}>{signed(r)}%</span>
}
