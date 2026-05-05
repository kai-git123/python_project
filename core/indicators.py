import pandas as pd
import numpy as np


def add_ma(df: pd.DataFrame, periods: list) -> pd.DataFrame:
    for p in periods:
        if len(df) >= p:
            df[f"MA{p}"] = df["Close"].rolling(window=p).mean()
    return df


def add_rsi(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    delta    = df["Close"].diff()
    gain     = delta.clip(lower=0)
    loss     = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
    avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
    rs       = avg_gain / avg_loss.replace(0, np.nan)
    df["RSI"] = 100 - (100 / (1 + rs))
    return df


def add_macd(df: pd.DataFrame, fast=12, slow=26, signal=9) -> pd.DataFrame:
    ema_fast      = df["Close"].ewm(span=fast,   adjust=False).mean()
    ema_slow      = df["Close"].ewm(span=slow,   adjust=False).mean()
    df["MACD"]        = ema_fast - ema_slow
    df["MACD_signal"] = df["MACD"].ewm(span=signal, adjust=False).mean()
    df["MACD_hist"]   = df["MACD"] - df["MACD_signal"]
    return df


def add_bollinger(df: pd.DataFrame, period: int = 20, std_dev: float = 2.0) -> pd.DataFrame:
    mid           = df["Close"].rolling(window=period).mean()
    std           = df["Close"].rolling(window=period).std()
    df["BB_upper"] = mid + std_dev * std
    df["BB_mid"]   = mid
    df["BB_lower"] = mid - std_dev * std
    return df
