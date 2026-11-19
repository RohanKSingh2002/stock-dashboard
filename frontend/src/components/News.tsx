import type { NewsItem } from '../types'
import { ago } from '../format'
import Skeleton from './Skeleton'

export default function News({ items, error }: { items: NewsItem[] | null; error: string }) {
  if (error) return <p className="note">Headlines are unavailable right now: {error}</p>
  if (!items)
    return (
      <ul className="news" aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="news-item">
            <span className="news-text">
              <Skeleton w="92%" h={14} />
              <Skeleton w="64%" h={14} />
              <Skeleton w={110} h={11} />
            </span>
          </li>
        ))}
      </ul>
    )
  if (!items.length) return <p className="note">No recent headlines for this symbol.</p>
  return (
    <ul className="news">
      {items.map((n) => (
        <li key={n.url}>
          <a className="news-item" href={n.url} target="_blank" rel="noreferrer noopener">
            <span className="news-text">
              <span className="news-title">{n.title}</span>
              <span className="news-meta">
                {n.publisher}
                {n.publisher && n.time ? ', ' : ''}
                {n.time ? ago(n.time) : ''}
              </span>
            </span>
            {n.thumbnail && <img src={n.thumbnail} alt="" loading="lazy" width={72} height={72} />}
          </a>
        </li>
      ))}
    </ul>
  )
}
