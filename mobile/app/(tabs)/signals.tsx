import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, FlatList,
} from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { Ionicons } from "@expo/vector-icons";
import { Dimensions } from "react-native";
import { getSignals, SignalRecord } from "../../services/api";
import { COLORS } from "../../constants/colors";

const W = Dimensions.get("window").width;

const STRATEGIES = [
  { key: "ma_cross", label: "MA 交叉" },
  { key: "rsi",      label: "RSI" },
  { key: "macd",     label: "MACD" },
  { key: "combined", label: "組合策略" },
];

const DAYS_OPTIONS = [90, 180, 365];

export default function SignalsScreen() {
  const [strategy, setStrategy] = useState("ma_cross");
  const [days, setDays]         = useState(365);
  const [fast, setFast]         = useState(20);
  const [slow, setSlow]         = useState(50);
  const [rsiLow, setRsiLow]     = useState(30);
  const [rsiHigh, setRsiHigh]   = useState(70);
  const [data, setData]         = useState<SignalRecord[]>([]);
  const [stats, setStats]       = useState<{ buy_count: number; sell_count: number; avg_ret_7d: number; win_rate_7d: number } | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSignals({ days, strategy, fast, slow, rsi_low: rsiLow, rsi_high: rsiHigh });
      setData(res.data);
      setStats(res.stats);
    } catch {
      setError("載入失敗");
    } finally {
      setLoading(false);
    }
  }, [days, strategy, fast, slow, rsiLow, rsiHigh]);

  React.useEffect(() => { load(); }, [load]);

  const sampled = data.filter((_, i) => i % Math.max(1, Math.ceil(data.length / 120)) === 0);
  const priceData = sampled.map(d => ({
    value: d.close,
    customDataPoint: d.signal !== 0 ? () => (
      <View style={[styles.signalDot, { backgroundColor: d.signal === 1 ? COLORS.green : COLORS.red }]} />
    ) : undefined,
    showCustomDataPoint: d.signal !== 0,
  }));

  const signalList = data.filter(d => d.signal !== 0).reverse();

  return (
    <ScrollView style={styles.container}>
      {/* Strategy Selector */}
      <View style={styles.stratRow}>
        {STRATEGIES.map(s => (
          <TouchableOpacity
            key={s.key}
            style={[styles.stratChip, strategy === s.key && styles.stratChipActive]}
            onPress={() => setStrategy(s.key)}
          >
            <Text style={[styles.stratText, strategy === s.key && styles.stratTextActive]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Days Selector */}
      <View style={styles.row}>
        <Text style={styles.label}>時間區間：</Text>
        {DAYS_OPTIONS.map(d => (
          <TouchableOpacity key={d} style={[styles.chip, days === d && styles.chipActive]} onPress={() => setDays(d)}>
            <Text style={[styles.chipText, days === d && styles.chipTextActive]}>
              {d >= 365 ? `${d / 365}年` : `${d}天`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Parameters */}
      {(strategy === "ma_cross" || strategy === "combined") && (
        <View style={styles.paramCard}>
          <Text style={styles.paramTitle}>MA 參數</Text>
          <View style={styles.paramRow}>
            <Text style={styles.paramLabel}>快線 MA{fast}</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setFast(v => Math.max(3, v - 5))}>
                <Text style={styles.stepText}>－</Text>
              </TouchableOpacity>
              <Text style={styles.stepVal}>{fast}</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setFast(v => Math.min(slow - 1, v + 5))}>
                <Text style={styles.stepText}>＋</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.paramRow}>
            <Text style={styles.paramLabel}>慢線 MA{slow}</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setSlow(v => Math.max(fast + 1, v - 10))}>
                <Text style={styles.stepText}>－</Text>
              </TouchableOpacity>
              <Text style={styles.stepVal}>{slow}</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setSlow(v => Math.min(300, v + 10))}>
                <Text style={styles.stepText}>＋</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {(strategy === "rsi" || strategy === "combined") && (
        <View style={styles.paramCard}>
          <Text style={styles.paramTitle}>RSI 門檻</Text>
          <View style={styles.paramRow}>
            <Text style={styles.paramLabel}>超賣（買入）: {rsiLow}</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setRsiLow(v => Math.max(10, v - 5))}>
                <Text style={styles.stepText}>－</Text>
              </TouchableOpacity>
              <Text style={styles.stepVal}>{rsiLow}</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setRsiLow(v => Math.min(45, v + 5))}>
                <Text style={styles.stepText}>＋</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.paramRow}>
            <Text style={styles.paramLabel}>超買（賣出）: {rsiHigh}</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setRsiHigh(v => Math.max(55, v - 5))}>
                <Text style={styles.stepText}>－</Text>
              </TouchableOpacity>
              <Text style={styles.stepVal}>{rsiHigh}</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setRsiHigh(v => Math.min(90, v + 5))}>
                <Text style={styles.stepText}>＋</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Stats */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{stats.buy_count}</Text>
            <Text style={[styles.statLabel, { color: COLORS.green }]}>🟢 買入訊號</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{stats.sell_count}</Text>
            <Text style={[styles.statLabel, { color: COLORS.red }]}>🔴 賣出訊號</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statVal, { color: stats.avg_ret_7d >= 0 ? COLORS.green : COLORS.red }]}>
              {stats.avg_ret_7d >= 0 ? "+" : ""}{stats.avg_ret_7d.toFixed(1)}%
            </Text>
            <Text style={styles.statLabel}>7日平均報酬</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{stats.win_rate_7d.toFixed(0)}%</Text>
            <Text style={styles.statLabel}>7日勝率</Text>
          </View>
        </View>
      )}

      {/* Chart */}
      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ margin: 32 }} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : priceData.length > 0 ? (
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>訊號標記（🟢買入 🔴賣出）</Text>
          <LineChart
            data={priceData}
            color={COLORS.primary}
            thickness={1.5}
            width={W - 48}
            height={180}
            yAxisTextStyle={styles.axisText}
            rulesColor={COLORS.border}
            xAxisColor={COLORS.border}
            yAxisColor={COLORS.border}
            backgroundColor={COLORS.card}
            formatYLabel={(v) => `$${(+v / 1000).toFixed(0)}k`}
            dataPointsRadius={0}
          />
        </View>
      ) : null}

      {/* Signal List */}
      <Text style={styles.listTitle}>最近訊號明細</Text>
      {signalList.slice(0, 20).map((item, idx) => (
        <View key={idx} style={styles.signalRow}>
          <View style={[styles.badge, { backgroundColor: item.signal === 1 ? COLORS.green + "22" : COLORS.red + "22" }]}>
            <Ionicons
              name={item.signal === 1 ? "trending-up" : "trending-down"}
              size={14}
              color={item.signal === 1 ? COLORS.green : COLORS.red}
            />
            <Text style={[styles.badgeText, { color: item.signal === 1 ? COLORS.green : COLORS.red }]}>
              {item.signal === 1 ? "買入" : "賣出"}
            </Text>
          </View>
          <Text style={styles.signalDate}>{item.date}</Text>
          <Text style={styles.signalPrice}>${item.close?.toLocaleString() ?? "--"}</Text>
          {item.rsi && (
            <Text style={[styles.signalRsi, { color: item.rsi > 70 ? COLORS.red : item.rsi < 30 ? COLORS.green : COLORS.muted }]}>
              RSI {item.rsi.toFixed(0)}
            </Text>
          )}
        </View>
      ))}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: COLORS.bg },
  stratRow:       { flexDirection: "row", padding: 12, gap: 8 },
  stratChip:      { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: COLORS.card, alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
  stratChipActive:{ backgroundColor: COLORS.primary + "22", borderColor: COLORS.primary },
  stratText:      { color: COLORS.muted, fontSize: 12, fontWeight: "500" },
  stratTextActive:{ color: COLORS.primary, fontWeight: "700" },
  row:            { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  label:          { color: COLORS.muted, fontSize: 12 },
  chip:           { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  chipActive:     { backgroundColor: COLORS.primary + "22", borderColor: COLORS.primary },
  chipText:       { color: COLORS.muted, fontSize: 12 },
  chipTextActive: { color: COLORS.primary, fontWeight: "600" },
  paramCard:      { marginHorizontal: 16, marginBottom: 8, backgroundColor: COLORS.card, borderRadius: 12, padding: 14 },
  paramTitle:     { color: COLORS.text, fontSize: 13, fontWeight: "700", marginBottom: 10 },
  paramRow:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  paramLabel:     { color: COLORS.muted, fontSize: 13 },
  stepper:        { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBtn:        { backgroundColor: COLORS.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  stepText:       { color: COLORS.text, fontSize: 16 },
  stepVal:        { color: COLORS.text, fontSize: 15, fontWeight: "600", minWidth: 28, textAlign: "center" },
  statsRow:       { flexDirection: "row", marginHorizontal: 16, marginBottom: 8, gap: 6 },
  statCard:       { flex: 1, backgroundColor: COLORS.card, borderRadius: 10, padding: 10, alignItems: "center" },
  statVal:        { color: COLORS.text, fontSize: 17, fontWeight: "700" },
  statLabel:      { color: COLORS.muted, fontSize: 10, marginTop: 3, textAlign: "center" },
  chartCard:      { marginHorizontal: 16, marginBottom: 12, backgroundColor: COLORS.card, borderRadius: 12, padding: 16 },
  chartTitle:     { color: COLORS.text, fontSize: 13, fontWeight: "600", marginBottom: 8 },
  axisText:       { color: COLORS.muted, fontSize: 10 },
  errorText:      { color: COLORS.muted, textAlign: "center", margin: 32 },
  listTitle:      { color: COLORS.text, fontSize: 14, fontWeight: "700", marginHorizontal: 16, marginBottom: 8 },
  signalRow:      { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 6, backgroundColor: COLORS.card, borderRadius: 10, padding: 10, gap: 8 },
  badge:          { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText:      { fontSize: 12, fontWeight: "600" },
  signalDate:     { color: COLORS.muted, fontSize: 12, flex: 1 },
  signalPrice:    { color: COLORS.text, fontSize: 13, fontWeight: "600" },
  signalRsi:      { fontSize: 11 },
  signalDot:      { width: 10, height: 10, borderRadius: 5 },
});
