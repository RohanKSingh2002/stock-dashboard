import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import type { Quote } from './types'

export type Connection = 'connecting' | 'live' | 'reconnecting'

/**
 * Loads a snapshot once per symbol-set change (with sparklines for `sparkFor`), then merges
 * live pushes from /ws. Reconnects with backoff when the socket drops.
 */
export function useLiveQuotes(symbols: string[], sparkFor: string[]) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [connection, setConnection] = useState<Connection>('connecting')
  const key = symbols.join(',')
  const sparkKey = sparkFor.join(',')
  const symbolsRef = useRef(symbols)
  symbolsRef.current = symbols
  const wsRef = useRef<WebSocket | null>(null)

  const merge = (incoming: Record<string, Quote>) =>
    setQuotes((prev) => {
      const next = { ...prev }
      for (const [s, q] of Object.entries(incoming)) next[s] = { ...prev[s], ...q }
      return next
    })

  useEffect(() => {
    if (!symbols.length) return
    let dead = false
    api
      .snapshot(symbols, sparkFor)
      .then((d) => !dead && merge(d))
      .catch(() => undefined)
    return () => {
      dead = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, sparkKey])

  useEffect(() => {
    let closed = false
    let retry = 0
    let timer = 0
    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${proto}://${location.host}/ws`)
      wsRef.current = ws
      ws.onopen = () => {
        retry = 0
        setConnection('live')
        ws.send(JSON.stringify({ type: 'subscribe', symbols: symbolsRef.current }))
      }
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data)
        if (msg.type === 'quotes') merge(msg.data)
      }
      ws.onclose = () => {
        if (closed) return
        setConnection('reconnecting')
        timer = window.setTimeout(connect, Math.min(1000 * 2 ** retry++, 15000))
      }
    }
    connect()
    return () => {
      closed = true
      window.clearTimeout(timer)
      wsRef.current?.close()
    }
  }, [])

  useEffect(() => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'subscribe', symbols }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { quotes, connection }
}
