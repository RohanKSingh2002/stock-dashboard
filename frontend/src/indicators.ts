export type Series = (number | null)[]

export function sma(v: number[], n: number): Series {
  const out: Series = []
  let sum = 0
  for (let i = 0; i < v.length; i++) {
    sum += v[i]
    if (i >= n) sum -= v[i - n]
    out.push(i >= n - 1 ? sum / n : null)
  }
  return out
}

export function ema(v: number[], n: number): Series {
  const out: Series = new Array(v.length).fill(null)
  if (v.length < n) return out
  const k = 2 / (n + 1)
  let prev = v.slice(0, n).reduce((a, b) => a + b, 0) / n
  out[n - 1] = prev
  for (let i = n; i < v.length; i++) {
    prev = v[i] * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

/** Wilder's RSI. */
export function rsi(v: number[], n = 14): Series {
  const out: Series = new Array(v.length).fill(null)
  if (v.length <= n) return out
  let gain = 0
  let loss = 0
  for (let i = 1; i <= n; i++) {
    const d = v[i] - v[i - 1]
    if (d >= 0) gain += d
    else loss -= d
  }
  gain /= n
  loss /= n
  const val = () => (loss === 0 ? 100 : 100 - 100 / (1 + gain / loss))
  out[n] = val()
  for (let i = n + 1; i < v.length; i++) {
    const d = v[i] - v[i - 1]
    gain = (gain * (n - 1) + Math.max(d, 0)) / n
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n
    out[i] = val()
  }
  return out
}

export function macd(v: number[], fast = 12, slow = 26, signal = 9) {
  const f = ema(v, fast)
  const s = ema(v, slow)
  const line: Series = v.map((_, i) => (f[i] != null && s[i] != null ? (f[i] as number) - (s[i] as number) : null))
  const first = line.findIndex((x) => x != null)
  const sig: Series = new Array(v.length).fill(null)
  if (first >= 0) {
    const e = ema(line.slice(first) as number[], signal)
    e.forEach((x, i) => (sig[first + i] = x))
  }
  const hist: Series = line.map((x, i) => (x != null && sig[i] != null ? x - (sig[i] as number) : null))
  return { line, signal: sig, hist }
}
