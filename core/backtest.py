import pandas as pd
import numpy as np


def run_backtest(df: pd.DataFrame, initial_capital: float = 100000,
                 stop_loss_pct: float = 0.05, take_profit_pct: float = 0.15,
                 fee_pct: float = 0.001) -> dict:
    """
    Event-driven backtest with stop-loss, take-profit, and trading fees.
    Expects df to have 'Close' and 'signal' columns.
    """
    capital   = initial_capital
    position  = 0.0   # BTC quantity held
    entry_price = 0.0
    trades    = []
    equity    = []

    for i, (dt, row) in enumerate(df.iterrows()):
        price = row["Close"]
        sig   = row.get("signal", 0)

        # Check stop-loss / take-profit while holding
        if position > 0:
            pnl_pct = (price - entry_price) / entry_price
            if pnl_pct <= -stop_loss_pct or pnl_pct >= take_profit_pct:
                reason = "停損" if pnl_pct <= -stop_loss_pct else "停利"
                proceeds = position * price * (1 - fee_pct)
                capital += proceeds
                trades.append({
                    "日期": dt.date(),
                    "動作": f"賣出({reason})",
                    "價格": round(price, 2),
                    "數量": round(position, 6),
                    "損益": round(proceeds - position * entry_price, 2),
                    "損益率": f"{pnl_pct*100:+.2f}%",
                    "資產": round(capital, 2),
                })
                position = 0.0
                entry_price = 0.0

        # Execute signal
        if sig == 1 and position == 0:  # Buy
            spend = capital * 0.99  # use 99% of capital
            btc_qty = spend / price / (1 + fee_pct)
            if btc_qty > 0:
                capital -= spend
                position = btc_qty
                entry_price = price
                trades.append({
                    "日期": dt.date(),
                    "動作": "買入",
                    "價格": round(price, 2),
                    "數量": round(btc_qty, 6),
                    "損益": 0,
                    "損益率": "—",
                    "資產": round(capital + position * price, 2),
                })

        elif sig == -1 and position > 0:  # Sell
            pnl_pct = (price - entry_price) / entry_price
            proceeds = position * price * (1 - fee_pct)
            capital += proceeds
            trades.append({
                "日期": dt.date(),
                "動作": "賣出(訊號)",
                "價格": round(price, 2),
                "數量": round(position, 6),
                "損益": round(proceeds - position * entry_price, 2),
                "損益率": f"{pnl_pct*100:+.2f}%",
                "資產": round(capital, 2),
            })
            position = 0.0
            entry_price = 0.0

        total_value = capital + position * price
        equity.append({"Date": dt, "equity": total_value})

    # Close remaining position at end
    if position > 0:
        price = df["Close"].iloc[-1]
        pnl_pct = (price - entry_price) / entry_price
        proceeds = position * price * (1 - fee_pct)
        capital += proceeds
        trades.append({
            "日期": df.index[-1].date(),
            "動作": "賣出(期末)",
            "價格": round(price, 2),
            "數量": round(position, 6),
            "損益": round(proceeds - position * entry_price, 2),
            "損益率": f"{pnl_pct*100:+.2f}%",
            "資產": round(capital, 2),
        })

    equity_df = pd.DataFrame(equity).set_index("Date")["equity"]
    trade_df  = pd.DataFrame(trades) if trades else pd.DataFrame(
        columns=["日期", "動作", "價格", "數量", "損益", "損益率", "資產"]
    )

    # Buy-and-hold benchmark
    bh_return = (df["Close"].iloc[-1] / df["Close"].iloc[0] - 1) * 100

    # Performance metrics
    total_return = (capital - initial_capital) / initial_capital * 100
    sell_trades  = [t for t in trades if "賣出" in t["動作"]]
    win_trades   = [t for t in sell_trades if isinstance(t["損益"], (int, float)) and t["損益"] > 0]
    win_rate     = len(win_trades) / len(sell_trades) * 100 if sell_trades else 0

    daily_ret    = equity_df.pct_change().dropna()
    sharpe       = (daily_ret.mean() / daily_ret.std() * np.sqrt(365)) if daily_ret.std() > 0 else 0
    peak         = equity_df.cummax()
    mdd          = ((equity_df - peak) / peak).min() * 100

    return {
        "equity":        equity_df,
        "trades":        trade_df,
        "total_return":  round(total_return, 2),
        "bh_return":     round(bh_return, 2),
        "win_rate":      round(win_rate, 2),
        "trade_count":   len(sell_trades),
        "sharpe":        round(sharpe, 3),
        "mdd":           round(mdd, 2),
        "final_capital": round(capital, 2),
    }


def grid_search(df: pd.DataFrame, fast_range: range, slow_range: range,
                initial_capital: float = 100000, fee_pct: float = 0.001) -> pd.DataFrame:
    from core.signals import ma_cross_signals

    results = []
    for fast in fast_range:
        for slow in slow_range:
            if fast >= slow:
                continue
            fast_col, slow_col = f"MA{fast}", f"MA{slow}"
            if fast_col not in df.columns or slow_col not in df.columns:
                continue
            sig_df = ma_cross_signals(df, fast, slow)
            sig_df = sig_df.dropna(subset=[fast_col, slow_col])
            if len(sig_df) < slow + 5:
                continue
            res = run_backtest(sig_df, initial_capital=initial_capital,
                               stop_loss_pct=99, take_profit_pct=99, fee_pct=fee_pct)
            results.append({
                "fast_ma": fast,
                "slow_ma": slow,
                "total_return": res["total_return"],
                "win_rate":     res["win_rate"],
                "trade_count":  res["trade_count"],
                "sharpe":       res["sharpe"],
                "mdd":          res["mdd"],
            })

    return pd.DataFrame(results)
