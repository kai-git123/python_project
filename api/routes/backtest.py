import math
from fastapi import APIRouter
from pydantic import BaseModel
from core.fetcher import fetch_ohlc
from core.indicators import add_ma, add_rsi, add_macd, add_bollinger
from core.signals import ma_cross_signals, rsi_signals, macd_signals, combined_signals
from core.backtest import run_backtest

router = APIRouter()


class BacktestRequest(BaseModel):
    days:            int   = 365
    strategy:        str   = "ma_cross"
    fast:            int   = 20
    slow:            int   = 50
    rsi_low:         int   = 30
    rsi_high:        int   = 70
    initial_capital: float = 100000
    stop_loss:       float = 5.0
    take_profit:     float = 15.0
    fee:             float = 0.1


def safe(val):
    if val is None:
        return None
    try:
        f = float(val)
        return None if math.isnan(f) or math.isinf(f) else round(f, 4)
    except Exception:
        return None


@router.post("/backtest")
def run_backtest_api(req: BacktestRequest):
    df = fetch_ohlc(req.days)
    df = add_ma(df, sorted({req.fast, req.slow, 20, 50}))
    df = add_rsi(df)
    df = add_macd(df)
    df = add_bollinger(df)

    if req.strategy == "ma_cross":
        sig_df = ma_cross_signals(df, req.fast, req.slow)
    elif req.strategy == "rsi":
        sig_df = rsi_signals(df, req.rsi_low, req.rsi_high)
    elif req.strategy == "macd":
        sig_df = macd_signals(df)
    else:
        sig_df = combined_signals(df, req.fast, req.slow, req.rsi_low, req.rsi_high)

    result = run_backtest(
        sig_df.dropna(subset=["Close"]),
        initial_capital=req.initial_capital,
        stop_loss_pct=req.stop_loss / 100,
        take_profit_pct=req.take_profit / 100,
        fee_pct=req.fee / 100,
    )

    # Downsample equity curve (max 120 points for mobile)
    equity = result["equity"]
    step   = max(1, len(equity) // 120)
    equity_data = [
        {"date": dt.strftime("%Y-%m-%d"), "value": round(float(v), 2)}
        for dt, v in equity.iloc[::step].items()
    ]

    trades = []
    if not result["trades"].empty:
        for _, row in result["trades"].iterrows():
            pnl = row["損益"]
            trades.append({
                "date":     str(row["日期"]),
                "action":   str(row["動作"]),
                "price":    safe(row["價格"]),
                "quantity": safe(row["數量"]),
                "pnl":      safe(pnl) if isinstance(pnl, (int, float)) and pnl != 0 else None,
                "pnl_pct":  str(row["損益率"]),
                "capital":  safe(row["資產"]),
            })

    return {
        "metrics": {
            "total_return":  result["total_return"],
            "bh_return":     result["bh_return"],
            "win_rate":      result["win_rate"],
            "trade_count":   result["trade_count"],
            "sharpe":        result["sharpe"],
            "mdd":           result["mdd"],
            "final_capital": result["final_capital"],
        },
        "equity":  equity_data,
        "trades":  trades,
    }
