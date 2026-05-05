import math
from fastapi import APIRouter
from core.fetcher import fetch_ohlc
from core.indicators import add_ma, add_rsi, add_macd, add_bollinger

router = APIRouter()


def safe(val):
    if val is None:
        return None
    try:
        f = float(val)
        return None if math.isnan(f) or math.isinf(f) else round(f, 2)
    except Exception:
        return None


@router.get("/price")
def get_price(days: int = 365):
    df = fetch_ohlc(days)
    df = add_ma(df, [5, 10, 20, 50, 100, 200])
    df = add_rsi(df)
    df = add_macd(df)
    df = add_bollinger(df)

    records = [
        {
            "date":        row.name.strftime("%Y-%m-%d"),
            "open":        safe(row["Open"]),
            "high":        safe(row["High"]),
            "low":         safe(row["Low"]),
            "close":       safe(row["Close"]),
            "volume":      safe(row.get("Volume")),
            "ma5":         safe(row.get("MA5")),
            "ma10":        safe(row.get("MA10")),
            "ma20":        safe(row.get("MA20")),
            "ma50":        safe(row.get("MA50")),
            "ma100":       safe(row.get("MA100")),
            "ma200":       safe(row.get("MA200")),
            "rsi":         safe(row.get("RSI")),
            "macd":        safe(row.get("MACD")),
            "macd_signal": safe(row.get("MACD_signal")),
            "macd_hist":   safe(row.get("MACD_hist")),
            "bb_upper":    safe(row.get("BB_upper")),
            "bb_mid":      safe(row.get("BB_mid")),
            "bb_lower":    safe(row.get("BB_lower")),
        }
        for _, row in df.iterrows()
    ]

    latest = records[-1]
    prev   = records[-2] if len(records) > 1 else latest
    change     = (latest["close"] or 0) - (prev["close"] or 0)
    change_pct = change / (prev["close"] or 1) * 100

    highs  = [r["high"]  for r in records if r["high"]  is not None]
    lows   = [r["low"]   for r in records if r["low"]   is not None]

    return {
        "data": records,
        "summary": {
            "latest_price": latest["close"],
            "change":       round(change, 2),
            "change_pct":   round(change_pct, 2),
            "period_high":  max(highs) if highs else None,
            "period_low":   min(lows)  if lows  else None,
            "rsi":          latest["rsi"],
            "macd":         latest["macd"],
            "macd_signal":  latest["macd_signal"],
        },
    }
