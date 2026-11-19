import { useEffect, useRef } from 'react'
import { price as fmtPrice } from '../format'

/** Renders a price where only the characters that changed roll in, tinted by direction. */
export default function AnimatedPrice({ value }: { value: number }) {
  const text = fmtPrice(value)
  const prevText = useRef<string | null>(null)
  const prevValue = useRef<number | null>(null)
  const dir = prevValue.current == null || value === prevValue.current ? '' : value > prevValue.current ? 'up' : 'down'

  useEffect(() => {
    prevText.current = text
    prevValue.current = value
  })

  const prev = prevText.current
  const chars = text.split('')
  return (
    <span className="price" aria-label={text}>
      {chars.map((ch, i) => {
        const fromRight = chars.length - 1 - i
        const before = prev ? prev[prev.length - 1 - fromRight] : undefined
        const roll = prev !== null && dir !== '' && before !== ch
        return (
          <span key={`${fromRight}:${ch}`} className={roll ? `digit roll ${dir}` : 'digit'} aria-hidden="true">
            {ch}
          </span>
        )
      })}
    </span>
  )
}
