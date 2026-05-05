import React, { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, FlatList,
} from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { Ionicons } from "@expo/vector-icons";
import { Dimensions } from "react-native";
import { runBacktest, BacktestMetrics, TradeRecord } from "../../services/api";
import { COLORS } from "../../constants/colors";

const W = Dimensions.get("window").width;

const STRATEGIES = [
  { key: "ma_cross", label: "MA 交叉" },
  { key: "rsi",      label: "RSI" },
  { key: "macd",     label: "MACD" },
  { key: "combined", label: "組合策略" },
];

function Stepper({ value, onDec, onInc, label }: { value: number; onDec: () => void; onInc: () => void; label: string }) {
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepper}>
        <TouchableOpacity style={styles.stepBtn} onPress={onDec}><Text style={styles.stepBtnText}>−</Text></TouchableOpacity>
        <Text style={styles.stepVal}>{value}</Text>
        <TouchableOpacity style={styles.stepBtn} onPress={onInc}><Text style={styles.stepBtnText}>+</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, color ? { color } : {}]}>{value}</Text>
      {sub && <Text style={styles.metricSub}>{sub}</Text>}
    </View>
  );
}

export default function BacktestScreen() {
  const [strategy, setStrategy]       = useState("ma_cross");
  const [days, setDays]               = useState(365);
  const [capital, setCapital]         = useState("100000");
  const [fast, setFast]               = useState(20);
  const [slow, setSlow]               = useState(50);
  const [stopLoss, setStopLoss]       = useState(5);
  const [takeProfit, setTakeProfit]   = useState(15);
  const [fee, setFee]                 = useState(1); // 0.1%
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [metrics, setMetrics]         = useState<BacktestMetrics | null>(null);
  const [equity, setEquity]           = useState<{ value: number }[]>([]);
  const [bh, setBh]                   = useState<{ value: number }[]>([]);
  const [trades, setTrades]           = useState<TradeRecord[]>([]);
  const [showTrades, setShowTrades]   = useState(false);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const cap = parseFloat(capital) || 100000;
      const res = await runBacktest({
        days, strategy, fast, slow,
        initial_capital: cap,
        stop_loss: stopLoss,
        take_profit: takeProfit,
        fee: fee / 10,  // stepper unit is 0.1%
      });
      setMetrics(res.metrics);
      setEquity(res.equity.map(e => ({ value: e.value })));
      const bhStart = res.equity[0]?.value ?? cap;
      const bhEnd   = res.metrics.bh_return / 100 * cap + cap;
      setBh([{ value: bhStart }, { value: bhEnd }]);
      setTrades(res.trades);
    } catch {
      setError("回測失敗，請確認伺服器已啟動");
    } finally {
      setLoading(false);
    }
  };

  const returnColor = metrics ? (metrics.total_return >= 0 ? COLORS.green : COLORS.red) : COLORS.text;
  const bhColor = metrics ? (metrics.bh_return >= 0 ? COLORS.green : COLORS.red) : COLORS.text;

  return (
    <ScrollView style={styles.container}>
      {/* Strategy */}
      <View style={styles.stratRow}>
        {STRATEGIES.map(s => (
          <TouchableOpacity
            key={s.key}
            style={[styles.stratChip, strategy === s.key && styles.stratChipActive]}
            onPress={() => setStrategy(s.key)}
          >
            <Text style={[styles.stratText, strategy === s.key && styles.stratTextActive]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Parameters */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>參數設定</Text>

        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>初始資金 (USD)</Text>
          <TextInput
            style={styles.input}
            value={capital}
            onChangeText={setCapital}
            keyboardType="numeric"
            placeholderTextColor={COLORS.muted}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.rowLabel}>
          <Text style={styles.inputLabel}>時間區間</Text>
          <View style={styles.chipRow}>
            {[90, 180, 365, 730].map(d => (
              <TouchableOpacity key={d} style={[styles.chip, days === d && styles.chipActive]} onPress={() => setDays(d)}>
                <Text style={[styles.chipText, days === d && styles.chipTextActive]}>
                  {d >= 365 ? `${d/365}年` : `${d}天`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {(strategy === "ma_cross" || strategy === "combined") && (
          <>
            <View style={styles.divider} />
            <Stepper label={`快線 MA${fast}`} value={fast}
              onDec={() => setFast(v => Math.max(3, v - 5))}
              onInc={() => setFast(v => Math.min(slow - 1, v + 5))} />
            <Stepper label={`慢線 MA${slow}`} value={slow}
              onDec={() => setSlow(v => Math.max(fast + 1, v - 10))}
              onInc={() => setSlow(v => Math.min(300, v + 10))} />
          </>
        )}

        <View style={styles.divider} />
        <Text style={[styles.cardTitle, { marginTop: 4 }]}>風險控制</Text>
        <Stepper label={`停損 ${stopLoss}%`} value={stopLoss}
          onDec={() => setStopLoss(v => Math.max(1, v - 1))}
          onInc={() => setStopLoss(v => Math.min(30, v + 1))} />
        <Stepper label={`停利 ${takeProfit}%`} value={takeProfit}
          onDec={() => setTakeProfit(v => Math.max(5, v - 5))}
          onInc={() => setTakeProfit(v => Math.min(100, v + 5))} />
        <Stepper label={`手續費 ${(fee / 10).toFixed(1)}%`} value={fee}
          onDec={() => setFee(v => Math.max(0, v - 1))}
          onInc={() => setFee(v => Math.min(10, v + 1))} />
      </View>

      {/* Run Button */}
      <TouchableOpacity style={styles.runBtn} onPress={run} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#000" />
          : <><Ionicons name="play" size={18} color="#000" /><Text style={styles.runText}> 執行回測</Text></>
        }
      </TouchableOpacity>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Results */}
      {metrics && (
        <>
          <Text style={styles.sectionTitle}>📊 績效結果</Text>
          <View style={styles.metricsGrid}>
            <MetricCard label="總報酬率" value={`${metrics.total_return >= 0 ? "+" : ""}${metrics.total_return.toFixed(2)}%`}
              sub={`買持: ${metrics.bh_return >= 0 ? "+" : ""}${metrics.bh_return.toFixed(1)}%`} color={returnColor} />
            <MetricCard label="最終資產" value={`$${metrics.final_capital.toLocaleString("en-US", { maximumFractionDigits: 0 })}`} />
            <MetricCard label="勝率" value={`${metrics.win_rate.toFixed(1)}%`}
              sub={`${metrics.trade_count} 次交易`} color={metrics.win_rate >= 50 ? COLORS.green : COLORS.red} />
            <MetricCard label="最大回撤" value={`${metrics.mdd.toFixed(2)}%`} color={COLORS.red} />
            <MetricCard label="Sharpe" value={metrics.sharpe.toFixed(2)}
              color={metrics.sharpe >= 1 ? COLORS.green : metrics.sharpe >= 0 ? COLORS.primary : COLORS.red} />
          </View>

          {/* Equity Curve */}
          {equity.length > 1 && (
            <View style={styles.chartCard}>
              <Text style={styles.chartTitle}>📈 資產曲線 vs 買入持有</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <LineChart
                  data={equity}
                  color={COLORS.primary}
                  thickness={2}
                  width={Math.max(W - 80, equity.length * 5)}
                  height={180}
                  spacing={Math.max(5, Math.floor((W - 80) / equity.length))}
                  initialSpacing={8}
                  hideDataPoints
                  yAxisTextStyle={styles.axisText}
                  xAxisLabelTextStyle={{ ...styles.axisText, marginTop: 4 }}
                  rulesColor={COLORS.border}
                  xAxisColor={COLORS.border}
                  yAxisColor={COLORS.border}
                  backgroundColor={COLORS.card}
                  noOfSections={4}
                  yAxisLabelWidth={52}
                  formatYLabel={(v) => `$${(Number(v) / 1000).toFixed(0)}k`}
                  showVerticalLines
                  verticalLinesColor={COLORS.border + "44"}
                  areaChart
                  startFillColor={COLORS.primary}
                  startOpacity={0.2}
                  endOpacity={0.0}
                />
              </ScrollView>
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: COLORS.primary }]} />
                  <Text style={styles.legendText}>策略資產</Text>
                </View>
              </View>
            </View>
          )}

          {/* Trade Records */}
          <TouchableOpacity style={styles.toggleRow} onPress={() => setShowTrades(v => !v)}>
            <Text style={styles.sectionTitle}>交易紀錄（{trades.length} 筆）</Text>
            <Ionicons name={showTrades ? "chevron-up" : "chevron-down"} size={16} color={COLORS.muted} />
          </TouchableOpacity>

          {showTrades && trades.map((t, idx) => {
            const isBuy = t.action.includes("買入");
            const pnl = t.pnl;
            return (
              <View key={idx} style={styles.tradeRow}>
                <View style={[styles.tradeBadge, { backgroundColor: isBuy ? COLORS.green + "22" : COLORS.red + "22" }]}>
                  <Text style={[styles.tradeBadgeText, { color: isBuy ? COLORS.green : COLORS.red }]}>
                    {t.action}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tradeDate}>{t.date}</Text>
                  <Text style={styles.tradePrice}>${t.price?.toLocaleString() ?? "--"}</Text>
                </View>
                {pnl != null && (
                  <Text style={[styles.tradePnl, { color: pnl >= 0 ? COLORS.green : COLORS.red }]}>
                    {pnl >= 0 ? "+" : ""}{pnl.toFixed(0)} ({t.pnl_pct})
                  </Text>
                )}
              </View>
            );
          })}
        </>
      )}
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.bg },
  stratRow:        { flexDirection: "row", padding: 12, gap: 8 },
  stratChip:       { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.card, alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
  stratChipActive: { backgroundColor: COLORS.primary + "22", borderColor: COLORS.primary },
  stratText:       { color: COLORS.muted, fontSize: 11, fontWeight: "500" },
  stratTextActive: { color: COLORS.primary, fontWeight: "700" },
  card:            { marginHorizontal: 16, marginBottom: 12, backgroundColor: COLORS.card, borderRadius: 12, padding: 16 },
  cardTitle:       { color: COLORS.text, fontSize: 14, fontWeight: "700", marginBottom: 12 },
  inputRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  inputLabel:      { color: COLORS.muted, fontSize: 13 },
  input:           { backgroundColor: COLORS.bg, color: COLORS.text, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, width: 140, textAlign: "right", borderWidth: 1, borderColor: COLORS.border, fontSize: 14 },
  divider:         { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  rowLabel:        { gap: 8 },
  chipRow:         { flexDirection: "row", gap: 6, marginTop: 4 },
  chip:            { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  chipActive:      { backgroundColor: COLORS.primary + "22", borderColor: COLORS.primary },
  chipText:        { color: COLORS.muted, fontSize: 12 },
  chipTextActive:  { color: COLORS.primary, fontWeight: "600" },
  stepperRow:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  stepperLabel:    { color: COLORS.muted, fontSize: 13 },
  stepper:         { flexDirection: "row", alignItems: "center", gap: 12 },
  stepBtn:         { backgroundColor: COLORS.bg, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.border },
  stepBtnText:     { color: COLORS.text, fontSize: 18, lineHeight: 22 },
  stepVal:         { color: COLORS.text, fontSize: 15, fontWeight: "700", minWidth: 30, textAlign: "center" },
  runBtn:          { marginHorizontal: 16, marginBottom: 16, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  runText:         { color: "#000", fontSize: 16, fontWeight: "bold" },
  errorText:       { color: COLORS.red, textAlign: "center", marginBottom: 16, fontSize: 13 },
  sectionTitle:    { color: COLORS.text, fontSize: 14, fontWeight: "700", marginHorizontal: 16, marginBottom: 8, marginTop: 4 },
  metricsGrid:     { flexDirection: "row", flexWrap: "wrap", marginHorizontal: 12, gap: 8, marginBottom: 12 },
  metricCard:      { flex: 1, minWidth: "44%", backgroundColor: COLORS.card, borderRadius: 10, padding: 12 },
  metricLabel:     { color: COLORS.muted, fontSize: 11, marginBottom: 4 },
  metricValue:     { color: COLORS.text, fontSize: 18, fontWeight: "700" },
  metricSub:       { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  chartCard:       { marginHorizontal: 16, marginBottom: 12, backgroundColor: COLORS.card, borderRadius: 12, padding: 16, overflow: "hidden" },
  chartTitle:      { color: COLORS.text, fontSize: 13, fontWeight: "600", marginBottom: 8 },
  axisText:        { color: COLORS.muted, fontSize: 9 },
  legendRow:       { flexDirection: "row", gap: 16, marginTop: 8 },
  legendItem:      { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot:       { width: 10, height: 3, borderRadius: 2 },
  legendText:      { color: COLORS.muted, fontSize: 11 },
  toggleRow:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginHorizontal: 16, marginBottom: 6 },
  tradeRow:        { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 6, backgroundColor: COLORS.card, borderRadius: 8, padding: 10, gap: 8 },
  tradeBadge:      { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tradeBadgeText:  { fontSize: 11, fontWeight: "600" },
  tradeDate:       { color: COLORS.muted, fontSize: 11 },
  tradePrice:      { color: COLORS.text, fontSize: 13, fontWeight: "600" },
  tradePnl:        { fontSize: 12, fontWeight: "600" },
});
