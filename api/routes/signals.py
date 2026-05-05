import math
from fastapi import APIRouter
from core.fetcher import fetch_ohlc
from core.indicators import add_ma, add_rsi, add_macd, add_bollinger
from core.signals import ma_cross_signals, rsi_signals, macd_signals, combined_signals

router = APIRouter()


def safe(val):
    if val is None:
        return None
    try:
        f = float(val)
        return None if math.isnan(f) or math.isinf(f) else round(f, 2)
    except Exception:
        return None


@router.get("/signals")
def get_signals(
    days:      int = 365,
    strategy:  str = "ma_cross",
    fast:      int = 20,
    slow:      int = 50,
    rsi_low:   int = 30,
    rsi_high:  int = 70,
):
    df = fetch_ohlc(days)
    df = add_ma(df, sorted({fast, slow, 20, 50}))
    df = add_rsi(df)
    df = add_macd(df)
    df = add_bollinger(df)

    if strategy == "ma_cross":
        sig_df = ma_cross_signals(df, fast, slow)
    elif strategy == "rsi":
        sig_df = rsi_signals(df, rsi_low, rsi_high)
    elif strategy == "macd":
        sig_df = macd_signals(df)
    else:
        sig_df = combined_signals(df, fast, slow, rsi_low, rsi_high)

    sig_df = sig_df.copy()
    sig_df["ret7d"] = sig_df["Close"].shift(-7) / sig_df["Close"] - 1

    records = [
        {
            "date":   row.name.strftime("%Y-%m-%d"),
            "close":  safe(row["Close"]),
            "signal": int(row["signal"]),
            "rsi":    safe(row.get("RSI")),
            "ma20":   safe(row.get("MA20")),
            "ma50":   safe(row.get("MA50")),
        }
        for _, row in sig_df.iterrows()
    ]

    buy_rets = sig_df[sig_df["signal"] == 1]["ret7d"].dropna()

    return {
        "data": records,
        "stats": {
            "buy_count":   int((sig_df["signal"] == 1).sum()),
            "sell_count":  int((sig_df["signal"] == -1).sum()),
            "avg_ret_7d":  round(float(buy_rets.mean()) * 100, 2) if len(buy_rets) else 0,
            "win_rate_7d": round(float((buy_rets > 0).mean()) * 100, 2) if len(buy_rets) else 0,
        },
    }
