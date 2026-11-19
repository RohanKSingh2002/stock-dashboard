import { useId } from 'react'

interface Props {
  values?: number[]
  up: boolean
  /** Draw a faint dotted line at this value (the previous close). */
  baseline?: number
  width?: number
  height?: number
}

export default function Sparkline({ values, up, baseline, width = 72, height = 30 }: Props) {
  const id = useId()
  if (!values || values.length < 2) return <svg className="spark" width={width} height={height} aria-hidden="true" />
  const all = baseline != null ? [...values, baseline] : values
  const min = Math.min(...all)
  const max = Math.max(...all)
  const span = max - min || 1
  const x = (i: number) => (i / (values.length - 1)) * width
  const y = (v: number) => height - 3 - ((v - min) / span) * (height - 6)
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const color = up ? 'var(--up)' : 'var(--down)'
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {baseline != null && (
        <line x1="0" x2={width} y1={y(baseline)} y2={y(baseline)} stroke="var(--muted)" strokeWidth="1" strokeDasharray="1 3" opacity="0.6" />
      )}
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#${id})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
