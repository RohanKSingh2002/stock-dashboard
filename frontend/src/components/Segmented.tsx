import type { ReactNode } from 'react'
import { motion } from 'motion/react'

interface Option<T extends string> {
  value: T
  label: string
  icon?: ReactNode
}
interface Props<T extends string> {
  id: string
  label: string
  options: Option<T>[]
  value: T
  onChange: (v: T) => void
}

/** Segmented control whose selection thumb slides between options (shared layout animation). */
export default function Segmented<T extends string>({ id, label, options, value, onChange }: Props<T>) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            aria-label={o.icon ? o.label : undefined}
            title={o.icon ? o.label : undefined}
            className={on ? 'on' : undefined}
            onClick={() => onChange(o.value)}
          >
            {on && (
              <motion.span
                layoutId={`seg-thumb-${id}`}
                className="seg-thumb"
                transition={{ type: 'spring', stiffness: 560, damping: 42 }}
              />
            )}
            <span className="seg-label">
              {o.icon}
              <span className={o.icon ? 'seg-text' : undefined}>{o.label}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
