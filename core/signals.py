import pandas as pd
import numpy as np


def ma_cross_signals(df: pd.DataFrame, fast: int, slow: int) -> pd.DataFrame:
    df = df.copy()
    fc, sc = f"MA{fast}", f"MA{slow}"
    df["signal"] = 0
    if fc not in df.columns or sc not in df.columns:
        return df
    golden = (df[fc] > df[sc]) & (df[fc].shift(1) <= df[sc].shift(1))
    death  = (df[fc] < df[sc]) & (df[fc].shift(1) >= df[sc].shift(1))
    df.loc[golden, "signal"] = 1
    df.loc[death,  "signal"] = -1
    return df


def rsi_signals(df: pd.DataFrame, oversold: int = 30, overbought: int = 70) -> pd.DataFrame:
    df = df.copy()
    df["signal"] = 0
    if "RSI" not in df.columns:
        return df
    df.loc[(df["RSI"] < oversold)   & (df["RSI"].shift(1) >= oversold),   "signal"] = 1
    df.loc[(df["RSI"] > overbought) & (df["RSI"].shift(1) <= overbought), "signal"] = -1
    return df


def macd_signals(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["signal"] = 0
    if "MACD" not in df.columns:
        return df
    bull = (df["MACD"] > df["MACD_signal"]) & (df["MACD"].shift(1) <= df["MACD_signal"].shift(1))
    bear = (df["MACD"] < df["MACD_signal"]) & (df["MACD"].shift(1) >= df["MACD_signal"].shift(1))
    df.loc[bull, "signal"] = 1
    df.loc[bear, "signal"] = -1
    return df


def combined_signals(df: pd.DataFrame, fast: int, slow: int,
                     rsi_low: int = 30, rsi_high: int = 70) -> pd.DataFrame:
    df = df.copy()
    score = (ma_cross_signals(df, fast, slow)["signal"] +
             rsi_signals(df, rsi_low, rsi_high)["signal"] +
             macd_signals(df)["signal"])
    df["signal"] = np.where(score >= 2, 1, np.where(score <= -2, -1, 0))
    return df
