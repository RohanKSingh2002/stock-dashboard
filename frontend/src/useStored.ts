import { useEffect, useState } from 'react'

/** useState that persists to localStorage; ignores corrupt or unavailable storage. */
export function useStored<T>(key: string, fallback: T, valid: (v: unknown) => boolean = () => true) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw != null) {
        const v = JSON.parse(raw)
        if (valid(v)) return v as T
      }
    } catch {
      /* fall back */
    }
    return fallback
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* storage unavailable */
    }
  }, [key, value])
  return [value, setValue] as const
}
