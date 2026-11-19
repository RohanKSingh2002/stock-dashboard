import type { RefObject } from 'react'
import { Moon, Search, Sun } from 'lucide-react'
import type { Connection } from '../useLiveQuotes'
import Logo from './Logo'
import MarketStatus from './MarketStatus'

interface Props {
  searchRef: RefObject<HTMLButtonElement | null>
  onSearch: () => void
  theme: string
  onTheme: () => void
  demo: boolean
  connection: Connection
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

export default function TopBar({ searchRef, onSearch, theme, onTheme, demo, connection }: Props) {
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <header className="top">
      <a className="brand" href="/" aria-label="Market Desk home">
        <Logo />
        <span>Market Desk</span>
      </a>
      <button ref={searchRef} type="button" className="search-trigger" onClick={onSearch} aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}>
        <Search size={16} aria-hidden="true" />
        <span>Search stocks, ETFs and indices</span>
        <kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>
      <div className="top-end">
        {demo && (
          <span className="demo" title="The server is running with DEMO=1, so every price on this page is synthetic.">
            Demo data
          </span>
        )}
        <MarketStatus connection={connection} />
        <button type="button" className="icon-btn" onClick={onTheme} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  )
}
