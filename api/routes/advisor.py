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


@router.get("/advisor")
def get_advisor():
    df = fetch_ohlc(180)
    df = add_ma(df, [5, 10, 20, 50, 100, 200])
    df = add_rsi(df)
    df = add_macd(df)
    df = add_bollinger(df)
    df = df.dropna(subset=["MA50", "RSI", "MACD", "BB_upper"])

    latest = df.iloc[-1]
    prev   = df.iloc[-2]
    score  = 0
    signals = []

    # ── MA 交叉 ──────────────────────────────────────────────────
    ma20, ma50 = latest["MA20"], latest["MA50"]
    p_ma20, p_ma50 = prev["MA20"], prev["MA50"]
    if ma20 > ma50 and p_ma20 <= p_ma50:
        score += 3
        signals.append({"indicator": "MA 交叉", "signal": "黃金交叉 🟢",
                         "desc": "MA20 上穿 MA50，短期趨勢轉強，為強烈買入訊號", "score": 3, "type": "buy"})
    elif ma20 < ma50 and p_ma20 >= p_ma50:
        score -= 3
        signals.append({"indicator": "MA 交叉", "signal": "死亡交叉 🔴",
                         "desc": "MA20 下穿 MA50，短期趨勢轉弱，為強烈賣出訊號", "score": -3, "type": "sell"})
    elif ma20 > ma50:
        score += 1
        signals.append({"indicator": "MA 趨勢", "signal": "多頭排列 📈",
                         "desc": "MA20 在 MA50 上方，趨勢偏多", "score": 1, "type": "buy"})
    else:
        score -= 1
        signals.append({"indicator": "MA 趨勢", "signal": "空頭排列 📉",
                         "desc": "MA20 在 MA50 下方，趨勢偏空", "score": -1, "type": "sell"})

    # ── RSI ──────────────────────────────────────────────────────
    rsi = latest["RSI"]
    if rsi < 30:
        score += 2
        signals.append({"indicator": "RSI", "signal": f"超賣 ({rsi:.1f}) 🟢",
                         "desc": "RSI 低於 30，市場超賣，反彈機率高", "score": 2, "type": "buy"})
    elif rsi < 40:
        score += 1
        signals.append({"indicator": "RSI", "signal": f"偏低 ({rsi:.1f})",
                         "desc": "RSI 偏低，具備買入機會", "score": 1, "type": "buy"})
    elif rsi > 70:
        score -= 2
        signals.append({"indicator": "RSI", "signal": f"超買 ({rsi:.1f}) 🔴",
                         "desc": "RSI 高於 70，市場超買，注意回落風險", "score": -2, "type": "sell"})
    elif rsi > 60:
        score -= 1
        signals.append({"indicator": "RSI", "signal": f"偏高 ({rsi:.1f})",
                         "desc": "RSI 偏高，上行空間有限", "score": -1, "type": "sell"})
    else:
        signals.append({"indicator": "RSI", "signal": f"中性 ({rsi:.1f}) ⚪",
                         "desc": "RSI 處於中性區間（40-60），無明確方向", "score": 0, "type": "neutral"})

    # ── MACD ─────────────────────────────────────────────────────
    macd, sig_line = latest["MACD"], latest["MACD_signal"]
    p_macd, p_sig  = prev["MACD"],  prev["MACD_signal"]
    if macd > sig_line and p_macd <= p_sig:
        score += 2
        signals.append({"indicator": "MACD", "signal": "黃金交叉 🟢",
                         "desc": "MACD 上穿訊號線，動能由空轉多", "score": 2, "type": "buy"})
    elif macd < sig_line and p_macd >= p_sig:
        score -= 2
        signals.append({"indicator": "MACD", "signal": "死亡交叉 🔴",
                         "desc": "MACD 下穿訊號線，動能由多轉空", "score": -2, "type": "sell"})
    elif macd > sig_line:
        score += 1
        signals.append({"indicator": "MACD", "signal": "多頭動能 📈",
                         "desc": "MACD 在訊號線上方，動能偏多", "score": 1, "type": "buy"})
    else:
        score -= 1
        signals.append({"indicator": "MACD", "signal": "空頭動能 📉",
                         "desc": "MACD 在訊號線下方，動能偏空", "score": -1, "type": "sell"})

    # ── 布林通道 ──────────────────────────────────────────────────
    bb_range = latest["BB_upper"] - latest["BB_lower"]
    bb_pos   = (latest["Close"] - latest["BB_lower"]) / bb_range if bb_range > 0 else 0.5
    if bb_pos < 0.15:
        score += 2
        signals.append({"indicator": "布林通道", "signal": "觸及下軌 🟢",
                         "desc": f"價格觸及布林下軌（位置 {bb_pos*100:.0f}%），超賣反彈機率高", "score": 2, "type": "buy"})
    elif bb_pos < 0.35:
        score += 1
        signals.append({"indicator": "布林通道", "signal": "接近下軌",
                         "desc": f"價格接近布林下軌（位置 {bb_pos*100:.0f}%），具備支撐", "score": 1, "type": "buy"})
    elif bb_pos > 0.85:
        score -= 2
        signals.append({"indicator": "布林通道", "signal": "觸及上軌 🔴",
                         "desc": f"價格觸及布林上軌（位置 {bb_pos*100:.0f}%），超買回調風險高", "score": -2, "type": "sell"})
    elif bb_pos > 0.65:
        score -= 1
        signals.append({"indicator": "布林通道", "signal": "接近上軌",
                         "desc": f"價格接近布林上軌（位置 {bb_pos*100:.0f}%），注意壓力", "score": -1, "type": "sell"})
    else:
        signals.append({"indicator": "布林通道", "signal": f"中性 ({bb_pos*100:.0f}%)",
                         "desc": "價格在布林通道中間區域，無明顯偏向", "score": 0, "type": "neutral"})

    # ── 長期趨勢（MA200）────────────────────────────────────────
    ma200 = latest.get("MA200")
    if ma200 and not math.isnan(float(ma200)):
        diff_pct = (latest["Close"] - float(ma200)) / float(ma200) * 100
        if latest["Close"] > float(ma200):
            score += 1
            signals.append({"indicator": "長期趨勢", "signal": f"多頭市場 (+{diff_pct:.1f}%)",
                             "desc": f"價格在 MA200 上方 {diff_pct:.1f}%，長期牛市格局", "score": 1, "type": "buy"})
        else:
            score -= 1
            signals.append({"indicator": "長期趨勢", "signal": f"空頭市場 ({diff_pct:.1f}%)",
                             "desc": f"價格在 MA200 下方 {abs(diff_pct):.1f}%，長期熊市格局", "score": -1, "type": "sell"})

    # ── 綜合判斷 ─────────────────────────────────────────────────
    if score >= 6:
        recommendation, rec_type, rec_emoji = "強烈買入", "strong_buy",  "🚀"
    elif score >= 2:
        recommendation, rec_type, rec_emoji = "建議買入",  "buy",         "📈"
    elif score >= -1:
        recommendation, rec_type, rec_emoji = "建議觀望",  "hold",        "⚖️"
    elif score >= -5:
        recommendation, rec_type, rec_emoji = "建議賣出",  "sell",        "📉"
    else:
        recommendation, rec_type, rec_emoji = "強烈賣出",  "strong_sell", "🔴"

    max_abs   = 11
    confidence = min(100, round(abs(score) / max_abs * 100, 1))
    buy_cnt   = sum(1 for s in signals if s["type"] == "buy")
    sell_cnt  = sum(1 for s in signals if s["type"] == "sell")

    # 7日/30日漲跌幅
    ret7d  = (latest["Close"] / df.iloc[-8]["Close"]  - 1) * 100 if len(df) >= 8  else None
    ret30d = (latest["Close"] / df.iloc[-31]["Close"] - 1) * 100 if len(df) >= 31 else None

    return {
        "recommendation": recommendation,
        "rec_type":        rec_type,
        "rec_emoji":       rec_emoji,
        "score":           score,
        "confidence":      confidence,
        "buy_signals":     buy_cnt,
        "sell_signals":    sell_cnt,
        "signals":         signals,
        "current_price":   safe(latest["Close"]),
        "rsi":             safe(rsi),
        "ret7d":           safe(ret7d),
        "ret30d":          safe(ret30d),
        "analysis_date":   str(df.index[-1].date()),
    }
