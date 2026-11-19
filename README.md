# Market Desk

A real-time stock dashboard. Live index strip and watchlist with sparklines, a chart with
area, candle and line views plus volume, SMA, EMA, RSI and MACD, key statistics with day
and 52-week ranges, latest news, a search palette (Ctrl K), and light and dark themes.
It is a rewrite of the original Streamlit app, which is kept in `legacy/`.

**Stack:** FastAPI and yfinance on the backend; React, TypeScript, Vite, TradingView
Lightweight Charts, Motion and Lucide icons on the frontend; a WebSocket for live prices.

## Run it (Windows)

Needs Python 3.10+ and Node.js 20+ installed.

**Double-click `run.bat`.** It installs everything, builds the app, starts it and opens
http://localhost:8000 in your browser. Run `run.bat demo` for synthetic data.

For development with hot reload, double-click `dev.bat` and open http://localhost:5173.

Or by hand:

```sh
python -m venv venv
venv\Scripts\activate
pip install -r backend\requirements.txt
cd backend && python -m uvicorn app:app --reload --port 8000     # terminal 1
cd frontend && npm install && npm run dev                        # terminal 2
```

## Using it

- Press **Ctrl K** (or **/**) to search. Enter opens a symbol; the plus button adds it to the watchlist.
- Click an index in the strip at the top to chart it.
- The change under the price follows the selected range: today's move on 1D, the move over the period otherwise.
- On the 1-day chart the dotted line marks the previous close.
- The watchlist, selected symbol, chart settings and theme are saved in the browser.

## How "real time" works

The server polls Yahoo Finance through `yfinance` and pushes quotes to the browser over a
WebSocket every 5 seconds (`PUSH_INTERVAL`). Yahoo data is unofficial and can be delayed or
rate limited; this is polling, not an exchange feed. Quotes are cached for a few seconds so
several browser tabs don't multiply requests. If a symbol fails, its row shows "No data"
with the reason on hover. Market status comes from Yahoo, falling back to the US trading
hours by the clock (which ignores exchange holidays).

To work on the UI without internet, run with synthetic data. The page shows a "Demo data" badge:

```sh
set DEMO=1
python -m uvicorn app:app --port 8000
```

## Design

The design follows the `modern-web-design` and `motion-framer` skills from
[claudedesignskills](https://github.com/freshtechbro/claudedesignskills). Tokens live at the
top of `frontend/src/styles.css`:

- Colour is chosen in OKLCH. Green and red only mean direction; the periwinkle accent marks
  selection and focus. Body text is at least 15:1 contrast, secondary text at least 7:1.
- One typeface, Geist, with tabular figures for every number.
- Radii step down by level: 14px for floating panels, 10px for groups, 7px for controls.
- Motion only answers a change: the sliding tab indicator, watchlist add and remove, price
  flashes, and the chart's live pulse. All of it respects reduced-motion settings.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/snapshot?symbols=AAPL,MSFT&spark=AAPL` | Quotes, plus 1-day sparklines for `spark` |
| `GET /api/history/{symbol}?range=1D` | OHLCV bars (`1D 5D 1M 6M 1Y 5Y MAX`) |
| `GET /api/info/{symbol}` | Company statistics |
| `GET /api/news/{symbol}` | Headlines |
| `GET /api/search?q=apple` | Symbol search |
| `GET /api/market` | US market session: `open`, `pre`, `post` or `closed` |
| `WS /ws` | Send `{"type":"subscribe","symbols":[...]}`, receive live quotes |

## Layout

```
backend/    FastAPI app and requirements
frontend/   React app: src/components, src/styles.css (design tokens), src/indicators.ts
legacy/     The original Streamlit version
run.bat     One-click launcher        dev.bat     Hot-reload development
```

## License

MIT
