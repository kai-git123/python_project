import time
import yfinance as yf
import pandas as pd
from pathlib import Path

CACHE_DIR = Path(__file__).parent.parent / "data" / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

OHLC_DAYS_MAP = {
    "30天":  30,
    "90天":  90,
    "180天": 180,
    "1年":   365,
    "2年":   730,
}

PERIOD_MAP = {
    30:  "1mo",
    90:  "3mo",
    180: "6mo",
    365: "1y",
    730: "2y",
}


def _load_cache(cache_file: Path) -> pd.DataFrame | None:
    """讀取本地快取，回傳 DataFrame 或 None"""
    if cache_file.exists():
        try:
            df = pd.read_csv(cache_file, index_col=0, parse_dates=True)
            df.index = pd.to_datetime(df.index).normalize()
            return df
        except Exception:
            return None
    return None


def fetch_ohlc(days: int) -> pd.DataFrame:
    """使用 yfinance 取得每日 OHLC（含 Volume），失敗時重試並回退至快取"""
    cache_file = CACHE_DIR / f"btc_{days}d.csv"
    period = PERIOD_MAP.get(days, "1y")

    last_err = None
    for attempt in range(3):          # 最多重試 3 次
        try:
            if attempt > 0:
                time.sleep(2 * attempt)   # 第 2 次等 2 秒，第 3 次等 4 秒

            ticker = yf.Ticker("BTC-USD")
            df = ticker.history(period=period, interval="1d")

            if df.empty:
                raise ValueError("yfinance 回傳空資料")

            df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
            df.index = pd.to_datetime(df.index).tz_localize(None).normalize()
            df = df[~df.index.duplicated(keep="last")].sort_index().dropna()
            df.to_csv(cache_file)
            return df

        except Exception as e:
            last_err = e
            # Rate limit → 等久一點再試
            if "rate" in str(e).lower() or "too many" in str(e).lower():
                time.sleep(5 * (attempt + 1))

    # 所有重試失敗 → 用快取
    cached = _load_cache(cache_file)
    if cached is not None:
        return cached

    raise ConnectionError(f"無法取得資料（已重試 3 次）：{last_err}")
