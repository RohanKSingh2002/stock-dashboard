"""Stock dashboard API: quotes, history, company info, news, and a live WebSocket feed.

Data comes from Yahoo Finance via yfinance (unofficial, polled, may be delayed or
rate limited). Set DEMO=1 to serve clearly-labelled synthetic data instead, which is
useful for working on the UI without network access.
"""
from __future__ import annotations

import asyncio
import math
import os
import random
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo
from typing import Any, Callable

import pandas as pd
import yfinance as yf
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse

DEMO = os.getenv("DEMO") == "1"
PUSH_INTERVAL = float(os.getenv("PUSH_INTERVAL", "5"))
SYMBOL_RE = re.compile(r"^[A-Z0-9.\-=^]{1,15}$")
MAX_SYMBOLS = 30

# range key -> (yfinance period, interval)
RANGES = {
    "1D": ("1d", "1m"),
    "5D": ("5d", "5m"),
    "1M": ("1mo", "30m"),
    "6M": ("6mo", "1d"),
    "1Y": ("1y", "1d"),
    "5Y": ("5y", "1wk"),
    "MAX": ("max", "1mo"),
}
DEMO_BARS = {"1D": 390, "5D": 390, "1M": 330, "6M": 126, "1Y": 252, "5Y": 260, "MAX": 240}
DEMO_STEP = {"1D": 60, "5D": 300, "1M": 1800, "6M": 86400, "1Y": 86400, "5Y": 604800, "MAX": 2592000}

app = FastAPI(title="Stock Dashboard API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ---------------------------------------------------------------- cache helpers
_cache: dict[str, tuple[float, Any]] = {}


def cached(key: str, ttl: float, fn: Callable[[], Any]) -> Any:
    now = time.time()
    hit = _cache.get(key)
    if hit and now - hit[0] < ttl:
        return hit[1]
    value = fn()
    _cache[key] = (now, value)
    return value


def clean_symbols(raw: list[str]) -> list[str]:
    out: list[str] = []
    for s in raw:
        s = str(s).strip().upper()
        if SYMBOL_RE.match(s) and s not in out:
            out.append(s)
    return out[:MAX_SYMBOLS]


# ---------------------------------------------------------------- demo data
def _seed(symbol: str) -> random.Random:
    return random.Random(sum(ord(c) * (i + 1) for i, c in enumerate(symbol)))


# Rough magnitudes so demo screens look plausible. These are synthetic, not market data.
DEMO_LEVELS = {
    "AAPL": 270, "MSFT": 480, "NVDA": 180, "GOOGL": 280, "AMZN": 230, "TSLA": 420, "META": 640,
    "SPY": 670, "QQQ": 600, "^GSPC": 6700, "^IXIC": 22800, "^DJI": 46800, "^RUT": 2450,
    "^VIX": 16.5, "BTC-USD": 92000,
}
# Intraday bar spacing in seconds; daily-and-longer ranges use calendar dates.
DEMO_VOL = {"1D": 0.0011, "5D": 0.0022, "1M": 0.004, "6M": 0.014, "1Y": 0.014, "5Y": 0.03, "MAX": 0.06}


def _demo_base(symbol: str) -> float:
    return DEMO_LEVELS.get(symbol) or 40 + _seed(symbol).random() * 460


def demo_quote(symbol: str) -> dict:
    base = _demo_base(symbol)
    t = time.time()
    r = _seed(symbol)
    phase, drift = r.random() * 10, r.uniform(-0.012, 0.014)
    price = base * (1 + drift + 0.004 * math.sin(t / 40 + phase) + 0.0012 * math.sin(t / 3.1 + phase))
    return {"price": round(price, 2), "prevClose": round(base, 2), "currency": "USD"}


def demo_history(symbol: str, rng_key: str) -> list[dict]:
    """A random walk rescaled so the last close meets the current demo quote."""
    r = _seed(symbol + rng_key)
    n, step, vol = DEMO_BARS[rng_key], DEMO_STEP[rng_key], DEMO_VOL[rng_key]
    now = int(time.time()) // step * step
    raw, price = [], 1.0
    for _ in range(n):
        o = price
        c = o * (1 + r.gauss(0.0002 if step < 86400 else 0.0008, vol))
        h = max(o, c) * (1 + abs(r.gauss(0, vol / 2)))
        l = min(o, c) * (1 - abs(r.gauss(0, vol / 2)))
        raw.append((o, h, l, c, int(r.uniform(2e5, 3e6))))
        price = c
    q = demo_quote(symbol)
    k_end = q["price"] / raw[-1][3]
    # The 1-day view opens at the previous close; longer views only need to end at the price.
    k_start = q["prevClose"] / raw[0][0] if rng_key == "1D" else k_end
    bars = []
    for i, (o, h, l, c, v) in enumerate(raw):
        k = k_start + (k_end - k_start) * i / (n - 1)
        t = now - (n - 1 - i) * step
        stamp = time.strftime("%Y-%m-%d", time.gmtime(t)) if step >= 86400 else t
        bars.append({"time": stamp, "open": o * k, "high": h * k, "low": l * k, "close": c * k, "volume": v})
    return bars


# ---------------------------------------------------------------- live data
def _fetch_quote(symbol: str) -> dict:
    if DEMO:
        q = demo_quote(symbol)
    else:
        fi = yf.Ticker(symbol).fast_info
        price, prev = fi["last_price"], fi["previous_close"]
        if price is None or prev is None or (isinstance(price, float) and math.isnan(price)):
            raise ValueError("no price returned")
        q = {"price": round(float(price), 4), "prevClose": round(float(prev), 4),
             "currency": fi["currency"] or "USD"}
    change = q["price"] - q["prevClose"]
    q["change"] = round(change, 4)
    q["changePct"] = round(change / q["prevClose"] * 100, 3) if q["prevClose"] else 0.0
    return q


def quote_one(symbol: str) -> dict:
    ttl = 0.5 if DEMO else 4
    try:
        return cached(f"q:{symbol}", ttl, lambda: _fetch_quote(symbol))
    except Exception as e:  # noqa: BLE001 - surface per-symbol failure to the UI
        return {"error": f"{type(e).__name__}: {e}"[:200]}


def _fetch_spark(symbol: str) -> list[float]:
    if DEMO:
        return [round(b["close"], 2) for b in demo_history(symbol, "1D")[-78:]]
    t = yf.Ticker(symbol)
    df = t.history(period="1d", interval="5m")
    if len(df) < 2:
        df = t.history(period="5d", interval="30m")
    return [round(float(x), 4) for x in df["Close"].dropna().tolist()][-80:]


def spark_one(symbol: str) -> list[float]:
    try:
        return cached(f"s:{symbol}", 120, lambda: _fetch_spark(symbol))
    except Exception:  # noqa: BLE001
        return []


async def get_quotes(symbols: list[str], spark_for: set[str] | None = None) -> dict[str, dict]:
    async def one(s: str) -> tuple[str, dict]:
        q = await asyncio.to_thread(quote_one, s)
        if spark_for and s in spark_for and "error" not in q:
            q = {**q, "spark": await asyncio.to_thread(spark_one, s)}
        return s, q

    return dict(await asyncio.gather(*(one(s) for s in symbols)))


def _fetch_history(symbol: str, rng_key: str) -> list[dict]:
    if DEMO:
        return demo_history(symbol, rng_key)
    period, interval = RANGES[rng_key]
    df = yf.Ticker(symbol).history(period=period, interval=interval, auto_adjust=True)
    df = df.dropna(subset=["Open", "High", "Low", "Close"])
    daily = interval in ("1d", "1wk", "1mo")
    return [
        {"time": ts.strftime("%Y-%m-%d") if daily else int(ts.timestamp()), "open": float(r.Open), "high": float(r.High),
         "low": float(r.Low), "close": float(r.Close), "volume": int(r.Volume)}
        for ts, r in df.iterrows()
    ]


INFO_FIELDS = {
    "name": "longName", "shortName": "shortName", "quoteType": "quoteType", "sector": "sector", "industry": "industry", "exchange": "fullExchangeName",
    "currency": "currency", "marketCap": "marketCap", "trailingPE": "trailingPE",
    "forwardPE": "forwardPE", "dividendYield": "dividendYield", "beta": "beta",
    "fiftyTwoWeekHigh": "fiftyTwoWeekHigh", "fiftyTwoWeekLow": "fiftyTwoWeekLow",
    "averageVolume": "averageVolume", "open": "open", "dayHigh": "dayHigh", "dayLow": "dayLow",
    "volume": "volume", "summary": "longBusinessSummary", "website": "website",
}


DEMO_NAMES = {
    "AAPL": "Apple Inc.", "MSFT": "Microsoft Corporation", "NVDA": "NVIDIA Corporation",
    "GOOGL": "Alphabet Inc.", "AMZN": "Amazon.com, Inc.", "TSLA": "Tesla, Inc.", "META": "Meta Platforms, Inc.",
    "SPY": "SPDR S&P 500 ETF Trust", "QQQ": "Invesco QQQ Trust", "^GSPC": "S&P 500", "^IXIC": "NASDAQ Composite",
    "^DJI": "Dow Jones Industrial Average", "^RUT": "Russell 2000", "^VIX": "CBOE Volatility Index",
    "BTC-USD": "Bitcoin USD",
}


def _fetch_info(symbol: str) -> dict:
    if DEMO:
        b = _demo_base(symbol)
        if symbol.startswith("^") or symbol.endswith("-USD"):
            return {"name": DEMO_NAMES.get(symbol, symbol), "exchange": "Demo exchange", "currency": "USD",
                    "fiftyTwoWeekHigh": b * 1.2, "fiftyTwoWeekLow": b * 0.7, "open": b,
                    "dayHigh": b * 1.01, "dayLow": b * 0.99}
        return {"name": DEMO_NAMES.get(symbol, symbol), "exchange": "Demo exchange",
                "sector": "Demo sector", "industry": "Synthetic data",
                "currency": "USD", "marketCap": int(b * 1e9), "trailingPE": 21.4, "forwardPE": 19.8,
                "dividendYield": 0.45, "beta": 1.1, "fiftyTwoWeekHigh": b * 1.2,
                "fiftyTwoWeekLow": b * 0.7, "averageVolume": 1_500_000, "volume": 1_200_000,
                "open": b, "dayHigh": b * 1.01, "dayLow": b * 0.99,
                "summary": "Synthetic demo data. Run without DEMO=1 for real Yahoo Finance data."}
    info = yf.Ticker(symbol).info or {}
    out = {k: info.get(v) for k, v in INFO_FIELDS.items() if info.get(v) is not None}
    out.setdefault("name", out.get("shortName", symbol))
    return out


def _fetch_news(symbol: str) -> list[dict]:
    if DEMO:
        now = int(time.time())
        return [{"title": f"Sample headline {i + 1} for {symbol}. Real headlines appear when demo mode is off.",
                 "publisher": "Demo data", "url": f"#demo-{i}", "time": now - (i * 2 + 1) * 2400,
                 "summary": "", "thumbnail": None} for i in range(5)]
    out = []
    for item in yf.Ticker(symbol).news or []:
        c = item.get("content")
        if c:  # current Yahoo format
            when = c.get("pubDate") or ""
            ts = int(pd.Timestamp(when).timestamp()) if when else 0
            url = (c.get("canonicalUrl") or {}).get("url") or (c.get("clickThroughUrl") or {}).get("url")
            thumbs = ((c.get("thumbnail") or {}).get("resolutions") or [])
            small = min(thumbs, key=lambda r: abs((r.get("width") or 0) - 170), default=None)
            out.append({"title": c.get("title"), "publisher": (c.get("provider") or {}).get("displayName"),
                        "url": url, "time": ts, "summary": c.get("summary") or "",
                        "thumbnail": small.get("url") if small else None})
        else:  # older format
            out.append({"title": item.get("title"), "publisher": item.get("publisher"),
                        "url": item.get("link"), "time": item.get("providerPublishTime", 0), "summary": "",
                        "thumbnail": None})
    return [n for n in out if n["title"] and n["url"]][:12]


def _search(q: str) -> list[dict]:
    if DEMO:
        pool = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "TSLA", "META", "NFLX", "SPY", "QQQ"]
        ql = q.lower()
        return [{"symbol": s, "name": DEMO_NAMES.get(s, s), "exchange": "Demo", "type": "EQUITY"}
                for s in pool if ql in s.lower() or ql in DEMO_NAMES.get(s, "").lower()][:8]
    res = yf.Search(q, max_results=8, news_count=0).quotes
    keep = {"EQUITY", "ETF", "INDEX", "CRYPTOCURRENCY", "MUTUALFUND"}
    return [{"symbol": r["symbol"], "name": r.get("shortname") or r.get("longname") or r["symbol"],
             "exchange": r.get("exchDisp", ""), "type": r.get("quoteType", "")}
            for r in res if r.get("quoteType") in keep and r.get("symbol")]


# ---------------------------------------------------------------- routes
def _check(symbol: str) -> str:
    s = symbol.strip().upper()
    if not SYMBOL_RE.match(s):
        raise HTTPException(400, "Invalid ticker symbol")
    return s


async def _run(fn: Callable[[], Any]) -> Any:
    try:
        return await asyncio.to_thread(fn)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"Data provider error: {type(e).__name__}: {e}"[:300]) from e


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "demo": DEMO, "pushInterval": PUSH_INTERVAL}


@app.get("/api/snapshot")
async def snapshot(symbols: str = Query(..., description="Comma-separated tickers"),
                   spark: str = Query("", description="Tickers that also need a 1-day sparkline")) -> dict:
    return await get_quotes(clean_symbols(symbols.split(",")), set(clean_symbols(spark.split(","))))


NY = ZoneInfo("America/New_York")
YAHOO_STATES = {"REGULAR": "open", "PRE": "pre", "POST": "post", "PREPRE": "closed",
                "POSTPOST": "closed", "CLOSED": "closed"}


def _clock_state() -> str:
    """US equity session by the clock. Ignores exchange holidays; used only as a fallback."""
    t = datetime.now(timezone.utc).astimezone(NY)
    m = t.hour * 60 + t.minute
    if t.weekday() >= 5:
        return "closed"
    if 570 <= m < 960:
        return "open"
    if 240 <= m < 570:
        return "pre"
    if 960 <= m < 1200:
        return "post"
    return "closed"


def _fetch_market() -> dict:
    if not DEMO:
        try:
            state = YAHOO_STATES.get((yf.Ticker("SPY").info or {}).get("marketState", ""))
            if state:
                return {"state": state, "source": "yahoo"}
        except Exception:  # noqa: BLE001 - fall back to the clock
            pass
    return {"state": _clock_state(), "source": "clock"}


@app.get("/api/market")
async def market() -> dict:
    return await _run(lambda: cached("market", 60, _fetch_market))


@app.get("/api/history/{symbol}")
async def history(symbol: str, range: str = "1D") -> dict:
    s = _check(symbol)
    if range not in RANGES:
        raise HTTPException(400, f"range must be one of {', '.join(RANGES)}")
    bars = await _run(lambda: cached(f"h:{s}:{range}", 5 if range == "1D" else 60,
                                     lambda: _fetch_history(s, range)))
    if not bars:
        raise HTTPException(404, f"No price history for {s}")
    return {"symbol": s, "range": range, "bars": bars}


@app.get("/api/info/{symbol}")
async def info(symbol: str) -> dict:
    s = _check(symbol)
    return await _run(lambda: cached(f"i:{s}", 300, lambda: _fetch_info(s)))


@app.get("/api/news/{symbol}")
async def news(symbol: str) -> list[dict]:
    s = _check(symbol)
    return await _run(lambda: cached(f"n:{s}", 300, lambda: _fetch_news(s)))


@app.get("/api/search")
async def search(q: str = Query(..., min_length=1, max_length=40)) -> list[dict]:
    return await _run(lambda: cached(f"search:{q.lower()}", 600, lambda: _search(q)))


@app.websocket("/ws")
async def live(ws: WebSocket) -> None:
    """Client sends {"type":"subscribe","symbols":[...]}; server pushes quotes every few seconds."""
    await ws.accept()
    symbols: list[str] = []

    async def pusher() -> None:
        while True:
            if symbols:
                data = await get_quotes(list(symbols))
                await ws.send_json({"type": "quotes", "data": data, "ts": time.time()})
            await asyncio.sleep(PUSH_INTERVAL)

    task = asyncio.create_task(pusher())
    try:
        while True:
            msg = await ws.receive_json()
            if isinstance(msg, dict) and msg.get("type") == "subscribe":
                symbols[:] = clean_symbols(msg.get("symbols", []))
    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        task.cancel()


# Serve the built frontend when present (single-process mode). Checked per request so a
# build that finishes after the server starts is picked up without a restart.
DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"


@app.get("/{path:path}")
def spa(path: str):
    if path.startswith("api/"):
        raise HTTPException(404, "Unknown API route")
    if not (DIST / "index.html").is_file():
        return HTMLResponse(
            "<h1>Market Desk API is running</h1><p>The frontend has not been built yet. "
            "Run <code>run.bat</code> (builds and serves it), or use <code>dev.bat</code> and open "
            "<a href='http://localhost:5173'>localhost:5173</a>.</p>",
            status_code=503,
        )
    f = (DIST / path).resolve()
    return FileResponse(f if f.is_file() and DIST in f.parents else DIST / "index.html")
