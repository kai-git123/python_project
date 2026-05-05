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


def fetch_ohlc(days: int) -> pd.DataFrame:
    """使用 yfinance 取得每日 OHLC（含 Volume）"""
    cache_file = CACHE_DIR / f"btc_{days}d.csv"
    period = PERIOD_MAP.get(days, "1y")

    try:
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
        if cache_file.exists():
            df = pd.read_csv(cache_file, index_col=0, parse_dates=True)
            df.index = pd.to_datetime(df.index).normalize()
            return df
        raise ConnectionError(f"無法取得資料：{e}")
