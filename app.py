import streamlit as st
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import plotly.express as px
import pandas as pd
import numpy as np

from core.fetcher import fetch_ohlc, OHLC_DAYS_MAP
from core.indicators import add_ma, add_rsi, add_macd, add_bollinger
from core.signals import ma_cross_signals, rsi_signals, macd_signals, combined_signals
from core.backtest import run_backtest, grid_search

# ── Page config ───────────────────────────────────────────────────────────────
st.set_page_config(page_title="BTC 分析儀表板", page_icon="₿", layout="wide")

st.markdown("""
<style>
    .metric-card { background:#1e2130; border-radius:10px; padding:16px; text-align:center; }
    .metric-val  { font-size:1.6rem; font-weight:700; color:#f0b90b; }
    .metric-lbl  { font-size:.8rem; color:#888; margin-bottom:4px; }
    .pos { color:#26a69a; } .neg { color:#ef5350; }
    div[data-testid="stTabs"] button { font-size:1rem; padding:8px 20px; }
</style>
""", unsafe_allow_html=True)

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.title("⚙️ 全域設定")
    period_label = st.selectbox("📅 時間區間", list(OHLC_DAYS_MAP.keys()), index=3)
    days = OHLC_DAYS_MAP[period_label]

    st.markdown("---")
    st.subheader("📊 移動平均線")
    ma_input = st.text_input("MA 週期（逗號分隔）", value="20, 50, 200")
    try:
        ma_periods = sorted({int(x.strip()) for x in ma_input.split(",") if x.strip().isdigit()})
        if not ma_periods:
            ma_periods = [20, 50, 200]
    except Exception:
        ma_periods = [20, 50, 200]

    st.markdown("---")
    st.subheader("📉 顯示指標")
    show_bb   = st.checkbox("布林通道 (BB20)", value=True)
    show_rsi  = st.checkbox("RSI", value=True)
    show_macd = st.checkbox("MACD", value=True)
    show_vol  = st.checkbox("成交量", value=True)

# ── Load & process data ───────────────────────────────────────────────────────
@st.cache_data(ttl=300, show_spinner=False)
def load_data(days):
    df = fetch_ohlc(days)   # yfinance 已含 Volume
    df.index = df.index.normalize()
    return df

with st.spinner("📡 載入 BTC 資料中..."):
    try:
        df_raw = load_data(days)
    except Exception as e:
        st.error(f"❌ 資料載入失敗：{e}")
        st.stop()

all_ma = sorted(set(ma_periods + [5, 10, 20, 50, 100, 200]))
df = add_ma(df_raw.copy(), all_ma)
df = add_rsi(df)
df = add_macd(df)
df = add_bollinger(df)

# ── Header metrics ────────────────────────────────────────────────────────────
latest = df["Close"].iloc[-1]
prev   = df["Close"].iloc[-2]
change = latest - prev
pct    = change / prev * 100
rsi_v  = df["RSI"].dropna().iloc[-1]
rsi_label = "🔴 超買" if rsi_v > 70 else ("🟢 超賣" if rsi_v < 30 else "⚪ 中性")

st.title("₿ Bitcoin 分析儀表板")
c1, c2, c3, c4, c5 = st.columns(5)
c1.metric("現價 (USD)",  f"${latest:,.2f}", f"{change:+.2f} ({pct:+.2f}%)")
c2.metric("區間最高",    f"${df['High'].max():,.2f}")
c3.metric("區間最低",    f"${df['Low'].min():,.2f}")
c4.metric("RSI (14)",    f"{rsi_v:.1f}", rsi_label)
macd_v = df["MACD"].dropna().iloc[-1]
sig_v  = df["MACD_signal"].dropna().iloc[-1]
c5.metric("MACD", f"{macd_v:.1f}", f"訊號線 {sig_v:.1f}")

st.markdown("---")

# ═══════════════════════════════════════════════════════════════════════════════
tab1, tab2, tab3, tab4 = st.tabs(["📈 價格走勢", "🎯 買賣訊號", "💰 模擬回測", "🔍 最佳化分析"])

MA_COLORS = ["#f6c90e", "#ff7f0e", "#2ca02c", "#9467bd", "#17becf"]

# ─────────────────────────────────────────────────────────────────────────────
# TAB 1 — 價格走勢
# ─────────────────────────────────────────────────────────────────────────────
with tab1:
    active_rows = 1 + sum([show_rsi, show_macd, show_vol])
    heights = [0.5]
    if show_rsi:  heights.append(0.17)
    if show_macd: heights.append(0.17)
    if show_vol:  heights.append(0.16)
    total = sum(heights)
    heights = [h / total for h in heights]

    fig1 = make_subplots(
        rows=active_rows, cols=1, shared_xaxes=True,
        row_heights=heights, vertical_spacing=0.03,
    )

    # Candlestick
    fig1.add_trace(go.Candlestick(
        x=df.index, open=df["Open"], high=df["High"],
        low=df["Low"], close=df["Close"], name="BTC/USD",
        increasing_line_color="#26a69a", decreasing_line_color="#ef5350",
        increasing_fillcolor="#26a69a", decreasing_fillcolor="#ef5350",
    ), row=1, col=1)

    # Bollinger Bands
    if show_bb:
        fig1.add_trace(go.Scatter(x=df.index, y=df["BB_upper"], name="BB上軌",
            line=dict(color="rgba(150,150,255,0.5)", dash="dot", width=1)), row=1, col=1)
        fig1.add_trace(go.Scatter(x=df.index, y=df["BB_lower"], name="BB下軌",
            line=dict(color="rgba(150,150,255,0.5)", dash="dot", width=1),
            fill="tonexty", fillcolor="rgba(150,150,255,0.06)"), row=1, col=1)
        fig1.add_trace(go.Scatter(x=df.index, y=df["BB_mid"], name="BB中線",
            line=dict(color="rgba(150,150,255,0.6)", width=1)), row=1, col=1)

    # MAs
    for i, p in enumerate(ma_periods):
        col = f"MA{p}"
        if col in df.columns:
            fig1.add_trace(go.Scatter(x=df.index, y=df[col], name=f"MA{p}",
                line=dict(color=MA_COLORS[i % len(MA_COLORS)], width=1.5)), row=1, col=1)

    cur_row = 2
    # RSI
    if show_rsi:
        fig1.add_trace(go.Scatter(x=df.index, y=df["RSI"], name="RSI",
            line=dict(color="#ab47bc", width=1.5)), row=cur_row, col=1)
        fig1.add_hline(y=70, line=dict(color="red",   dash="dash", width=1), row=cur_row, col=1)
        fig1.add_hline(y=30, line=dict(color="green", dash="dash", width=1), row=cur_row, col=1)
        fig1.add_hrect(y0=70, y1=100, fillcolor="red",   opacity=0.05, row=cur_row, col=1)
        fig1.add_hrect(y0=0,  y1=30,  fillcolor="green", opacity=0.05, row=cur_row, col=1)
        fig1.update_yaxes(range=[0, 100], title_text="RSI", row=cur_row, col=1)
        cur_row += 1

    # MACD
    if show_macd:
        fig1.add_trace(go.Scatter(x=df.index, y=df["MACD"], name="MACD",
            line=dict(color="#42a5f5", width=1.5)), row=cur_row, col=1)
        fig1.add_trace(go.Scatter(x=df.index, y=df["MACD_signal"], name="訊號線",
            line=dict(color="#ff7043", width=1.5)), row=cur_row, col=1)
        colors_hist = ["#26a69a" if v >= 0 else "#ef5350" for v in df["MACD_hist"].fillna(0)]
        fig1.add_trace(go.Bar(x=df.index, y=df["MACD_hist"], name="MACD柱",
            marker_color=colors_hist, opacity=0.6), row=cur_row, col=1)
        fig1.update_yaxes(title_text="MACD", row=cur_row, col=1)
        cur_row += 1

    # Volume
    if show_vol and "Volume" in df.columns:
        vol_colors = ["#26a69a" if c >= o else "#ef5350"
                      for c, o in zip(df["Close"], df["Open"])]
        fig1.add_trace(go.Bar(x=df.index, y=df["Volume"], name="成交量",
            marker_color=vol_colors, opacity=0.6), row=cur_row, col=1)
        fig1.update_yaxes(title_text="成交量", row=cur_row, col=1)

    fig1.update_layout(
        height=750, template="plotly_dark",
        paper_bgcolor="#0e1117", plot_bgcolor="#0e1117",
        legend=dict(orientation="h", yanchor="bottom", y=1.01, x=0),
        xaxis_rangeslider_visible=False, hovermode="x unified",
        margin=dict(l=60, r=20, t=40, b=40),
    )
    fig1.update_yaxes(tickprefix="$", tickformat=",.0f", row=1, col=1)
    st.plotly_chart(fig1, use_container_width=True)

# ─────────────────────────────────────────────────────────────────────────────
# TAB 2 — 買賣訊號
# ─────────────────────────────────────────────────────────────────────────────
with tab2:
    st.subheader("🎯 買賣訊號分析")

    col_s1, col_s2 = st.columns([1, 3])
    with col_s1:
        strategy = st.selectbox("選擇策略", ["MA 黃金死亡交叉", "RSI 超買超賣", "MACD 交叉", "組合策略（多數決）"])

        if strategy == "MA 黃金死亡交叉":
            s_fast = st.number_input("快線 MA", min_value=3, max_value=100, value=20)
            s_slow = st.number_input("慢線 MA", min_value=5, max_value=300, value=50)
            sig_df = ma_cross_signals(df, int(s_fast), int(s_slow))
        elif strategy == "RSI 超買超賣":
            rsi_low  = st.slider("超賣門檻（買入）", 10, 45, 30)
            rsi_high = st.slider("超買門檻（賣出）", 55, 90, 70)
            sig_df = rsi_signals(df, rsi_low, rsi_high)
        elif strategy == "MACD 交叉":
            sig_df = macd_signals(df)
            st.caption("MACD(12,26,9) 固定參數")
        else:
            s_fast = st.number_input("快線 MA", min_value=3, max_value=100, value=20)
            s_slow = st.number_input("慢線 MA", min_value=5, max_value=300, value=50)
            sig_df = combined_signals(df, int(s_fast), int(s_slow))

        buys  = sig_df[sig_df["signal"] == 1]
        sells = sig_df[sig_df["signal"] == -1]

        st.markdown("---")
        st.markdown(f"**買入訊號：** `{len(buys)}` 次")
        st.markdown(f"**賣出訊號：** `{len(sells)}` 次")

        # Forward-return stats
        sig_df = sig_df.copy()
        sig_df["ret7d"]  = sig_df["Close"].shift(-7)  / sig_df["Close"] - 1
        sig_df["ret14d"] = sig_df["Close"].shift(-14) / sig_df["Close"] - 1

        buy_ret = sig_df[sig_df["signal"] == 1]["ret7d"].dropna()
        if len(buy_ret):
            st.metric("買入後 7 日平均報酬", f"{buy_ret.mean()*100:+.2f}%",
                      f"勝率 {(buy_ret>0).mean()*100:.0f}%")

    with col_s2:
        fig2 = make_subplots(rows=2, cols=1, shared_xaxes=True,
                             row_heights=[0.72, 0.28], vertical_spacing=0.04)

        fig2.add_trace(go.Candlestick(
            x=sig_df.index, open=sig_df["Open"], high=sig_df["High"],
            low=sig_df["Low"], close=sig_df["Close"], name="BTC/USD",
            increasing_line_color="#26a69a", decreasing_line_color="#ef5350",
            increasing_fillcolor="#26a69a", decreasing_fillcolor="#ef5350",
            showlegend=False,
        ), row=1, col=1)

        for i, p in enumerate(ma_periods):
            col_name = f"MA{p}"
            if col_name in sig_df.columns:
                fig2.add_trace(go.Scatter(x=sig_df.index, y=sig_df[col_name],
                    name=f"MA{p}", line=dict(color=MA_COLORS[i % len(MA_COLORS)], width=1.2),
                ), row=1, col=1)

        if len(buys):
            fig2.add_trace(go.Scatter(
                x=buys.index, y=buys["Low"] * 0.99,
                mode="markers", name="買入",
                marker=dict(symbol="triangle-up", size=12, color="#26a69a"),
            ), row=1, col=1)
        if len(sells):
            fig2.add_trace(go.Scatter(
                x=sells.index, y=sells["High"] * 1.01,
                mode="markers", name="賣出",
                marker=dict(symbol="triangle-down", size=12, color="#ef5350"),
            ), row=1, col=1)

        # RSI subplot
        if "RSI" in sig_df.columns:
            fig2.add_trace(go.Scatter(x=sig_df.index, y=sig_df["RSI"], name="RSI",
                line=dict(color="#ab47bc", width=1.2)), row=2, col=1)
            fig2.add_hline(y=70, line=dict(color="red",   dash="dash", width=1), row=2, col=1)
            fig2.add_hline(y=30, line=dict(color="green", dash="dash", width=1), row=2, col=1)
            fig2.update_yaxes(range=[0, 100], title_text="RSI", row=2, col=1)

        fig2.update_layout(
            height=620, template="plotly_dark",
            paper_bgcolor="#0e1117", plot_bgcolor="#0e1117",
            legend=dict(orientation="h", yanchor="bottom", y=1.01, x=0),
            xaxis_rangeslider_visible=False, hovermode="x unified",
            margin=dict(l=60, r=20, t=30, b=40),
        )
        fig2.update_yaxes(tickprefix="$", tickformat=",.0f", row=1, col=1)
        st.plotly_chart(fig2, use_container_width=True)

    # Signal table
    with st.expander("📋 訊號明細"):
        show_sig = sig_df[sig_df["signal"] != 0][["Open","High","Low","Close","signal"]].copy()
        show_sig["訊號"] = show_sig["signal"].map({1: "🟢 買入", -1: "🔴 賣出"})
        show_sig.index = show_sig.index.date
        st.dataframe(show_sig.drop(columns=["signal"]).sort_index(ascending=False),
                     use_container_width=True)

# ─────────────────────────────────────────────────────────────────────────────
# TAB 3 — 模擬回測
# ─────────────────────────────────────────────────────────────────────────────
with tab3:
    st.subheader("💰 策略回測模擬")

    col_b1, col_b2 = st.columns([1, 3])
    with col_b1:
        st.markdown("**交易設定**")
        bt_capital   = st.number_input("初始資金 (USD)", min_value=1000, max_value=10_000_000,
                                        value=100_000, step=1000)
        bt_strategy  = st.selectbox("回測策略",
                                     ["MA 黃金死亡交叉", "RSI 超買超賣", "MACD 交叉", "組合策略"],
                                     key="bt_strat")
        if bt_strategy == "MA 黃金死亡交叉":
            bt_fast = st.number_input("快線 MA", min_value=3, max_value=100, value=20, key="btf")
            bt_slow = st.number_input("慢線 MA", min_value=5, max_value=300, value=50, key="bts")
            bt_sig_df = ma_cross_signals(df, int(bt_fast), int(bt_slow))
        elif bt_strategy == "RSI 超買超賣":
            bt_rsi_low  = st.slider("超賣買入", 10, 45, 30, key="brl")
            bt_rsi_high = st.slider("超買賣出", 55, 90, 70, key="brh")
            bt_sig_df = rsi_signals(df, bt_rsi_low, bt_rsi_high)
        elif bt_strategy == "MACD 交叉":
            bt_sig_df = macd_signals(df)
        else:
            bt_fast = st.number_input("快線 MA", min_value=3, max_value=100, value=20, key="bcf")
            bt_slow = st.number_input("慢線 MA", min_value=5, max_value=300, value=50, key="bcs")
            bt_sig_df = combined_signals(df, int(bt_fast), int(bt_slow))

        st.markdown("**風險控制**")
        stop_loss    = st.slider("停損 (%)", 1, 30, 5)
        take_profit  = st.slider("停利 (%)", 5, 100, 15)
        fee          = st.slider("手續費 (%)", 0, 100, 10, help="以 0.01% 為單位") / 10000

        run_bt = st.button("▶ 執行回測", use_container_width=True, type="primary")

    with col_b2:
        if run_bt or "bt_result" not in st.session_state:
            with st.spinner("回測中..."):
                result = run_backtest(
                    bt_sig_df.dropna(subset=["Close"]),
                    initial_capital=bt_capital,
                    stop_loss_pct=stop_loss / 100,
                    take_profit_pct=take_profit / 100,
                    fee_pct=fee,
                )
            st.session_state["bt_result"] = result

        result = st.session_state["bt_result"]

        # Metrics
        r1, r2, r3, r4, r5 = st.columns(5)
        r1.metric("總報酬率",    f"{result['total_return']:+.2f}%",
                  f"買持 {result['bh_return']:+.2f}%")
        r2.metric("最終資產",    f"${result['final_capital']:,.0f}")
        r3.metric("勝率",        f"{result['win_rate']:.1f}%")
        r4.metric("交易次數",    f"{result['trade_count']} 次")
        r5.metric("最大回撤",    f"{result['mdd']:.2f}%")

        st.markdown(f"**Sharpe Ratio：** `{result['sharpe']}`")

        # Equity curve
        eq = result["equity"]
        bh = bt_capital * df["Close"] / df["Close"].iloc[0]

        fig3 = go.Figure()
        fig3.add_trace(go.Scatter(x=eq.index, y=eq.values, name="策略資產",
            line=dict(color="#f0b90b", width=2), fill="tozeroy",
            fillcolor="rgba(240,185,11,0.07)"))
        fig3.add_trace(go.Scatter(x=bh.index, y=bh.values, name="買入持有",
            line=dict(color="#9e9e9e", width=1.5, dash="dash")))
        fig3.add_hline(y=bt_capital, line=dict(color="white", dash="dot", width=1))

        fig3.update_layout(
            height=350, template="plotly_dark",
            paper_bgcolor="#0e1117", plot_bgcolor="#0e1117",
            hovermode="x unified", margin=dict(l=60, r=20, t=30, b=40),
            legend=dict(orientation="h", y=1.05),
        )
        fig3.update_yaxes(tickprefix="$", tickformat=",.0f")
        st.plotly_chart(fig3, use_container_width=True)

        # Trade log
        if not result["trades"].empty:
            with st.expander(f"📋 交易紀錄（共 {len(result['trades'])} 筆）"):
                trades_show = result["trades"].copy()
                def color_pnl(val):
                    if isinstance(val, (int, float)):
                        color = "#26a69a" if val > 0 else ("#ef5350" if val < 0 else "white")
                        return f"color: {color}"
                    return ""
                st.dataframe(
                    trades_show.style.map(color_pnl, subset=["損益"]),
                    use_container_width=True,
                )

# ─────────────────────────────────────────────────────────────────────────────
# TAB 4 — 最佳化分析
# ─────────────────────────────────────────────────────────────────────────────
with tab4:
    st.subheader("🔍 MA 參數最佳化（暴力搜尋）")

    col_g1, col_g2 = st.columns([1, 3])
    with col_g1:
        st.markdown("**搜尋範圍設定**")
        fast_min = st.number_input("快線最小值", 3, 50,  5)
        fast_max = st.number_input("快線最大值", 5, 100, 30)
        fast_step= st.number_input("快線步長",   1, 10,  5)
        slow_min = st.number_input("慢線最小值", 10, 100,  20)
        slow_max = st.number_input("慢線最大值", 20, 500, 200)
        slow_step= st.number_input("慢線步長",   1, 20,   10)
        metric   = st.selectbox("排序指標", ["total_return", "sharpe", "win_rate"])
        run_gs   = st.button("🚀 開始搜尋", use_container_width=True, type="primary")

    with col_g2:
        if run_gs:
            fast_r = range(int(fast_min), int(fast_max) + 1, int(fast_step))
            slow_r = range(int(slow_min), int(slow_max) + 1, int(slow_step))
            total_combos = sum(1 for f in fast_r for s in slow_r if f < s)

            with st.spinner(f"搜尋 {total_combos} 種參數組合中..."):
                all_ma_g = sorted(set(list(fast_r) + list(slow_r)))
                df_g = add_ma(df_raw.copy(), all_ma_g)
                df_g = add_rsi(df_g)
                df_g = add_macd(df_g)
                gs_result = grid_search(df_g, fast_r, slow_r)

            if gs_result.empty:
                st.warning("沒有有效的參數組合，請調整搜尋範圍。")
            else:
                st.session_state["gs_result"] = gs_result
                st.session_state["gs_metric"]  = metric

        if "gs_result" in st.session_state:
            gs   = st.session_state["gs_result"]
            met  = st.session_state.get("gs_metric", metric)

            best = gs.sort_values(met, ascending=False).iloc[0]
            b1, b2, b3, b4 = st.columns(4)
            b1.metric("最佳快線", f"MA{int(best['fast_ma'])}")
            b2.metric("最佳慢線", f"MA{int(best['slow_ma'])}")
            b3.metric("最佳報酬", f"{best['total_return']:+.2f}%")
            b4.metric("勝率",     f"{best['win_rate']:.1f}%")

            # Heatmap
            pivot = gs.pivot_table(index="slow_ma", columns="fast_ma", values=met)
            fig4 = px.imshow(
                pivot,
                color_continuous_scale="RdYlGn",
                labels=dict(x="快線 MA", y="慢線 MA", color=met),
                title=f"熱力圖：{met}",
                text_auto=".1f",
            )
            fig4.update_layout(
                height=480, template="plotly_dark",
                paper_bgcolor="#0e1117", margin=dict(l=60, r=20, t=50, b=40),
            )
            st.plotly_chart(fig4, use_container_width=True)

            # Top 10 table
            with st.expander("📋 前 20 名參數組合"):
                top20 = gs.sort_values(met, ascending=False).head(20).reset_index(drop=True)
                top20.index += 1
                st.dataframe(top20.style.format({
                    "total_return": "{:+.2f}%",
                    "win_rate":     "{:.1f}%",
                    "sharpe":       "{:.3f}",
                    "mdd":          "{:.2f}%",
                }), use_container_width=True)
        else:
            st.info("設定搜尋範圍後按「開始搜尋」，系統將自動找出歷史最佳 MA 參數組合。")
