import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  ActivityIndicator, TouchableOpacity, Dimensions,
} from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getPrice, PriceSummary, PriceRecord } from "../../services/api";
import { COLORS } from "../../constants/colors";

const W = Dimensions.get("window").width;

function MetricCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, color ? { color } : {}]}>{value}</Text>
      {sub && <Text style={styles.metricSub}>{sub}</Text>}
    </View>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const [summary, setSummary]     = useState<PriceSummary | null>(null);
  const [chartData, setChartData] = useState<{ value: number; label: string; labelTextStyle: object }[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await getPrice(30);
      setSummary(res.summary);
      const raw = res.data as PriceRecord[];
      const interval = Math.max(1, Math.ceil(raw.length / 5));
      setChartData(raw.map((d, i) => ({
        value: d.close,
        label: i % interval === 0 ? d.date.slice(5) : "",
        labelTextStyle: { color: COLORS.muted, fontSize: 9 },
      })));
      setError(null);
    } catch {
      setError("無法連接到伺服器\n請確認 API 已啟動且 IP 設定正確");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>載入中...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="wifi-outline" size={48} color={COLORS.muted} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); load(); }}>
          <Text style={styles.retryText}>重新連線</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isUp       = (summary?.change ?? 0) >= 0;
  const changeColor = isUp ? COLORS.green : COLORS.red;
  const rsiVal     = summary?.rsi ?? 0;
  const rsiColor   = rsiVal > 70 ? COLORS.red : rsiVal < 30 ? COLORS.green : COLORS.text;
  const rsiLabel   = rsiVal > 70 ? "超買 ⚠️" : rsiVal < 30 ? "超賣 📉" : "中性";
  const minPrice   = chartData.length ? Math.min(...chartData.map(d => d.value)) : 0;
  const maxPrice   = chartData.length ? Math.max(...chartData.map(d => d.value)) : 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          tintColor={COLORS.primary}
        />
      }
    >
      {/* 現價卡片 */}
      <View style={styles.priceCard}>
        <Text style={styles.priceLabel}>Bitcoin (BTC/USD)</Text>
        <Text style={styles.priceValue}>
          ${(summary?.latest_price ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </Text>
        <View style={styles.changeRow}>
          <Ionicons name={isUp ? "caret-up" : "caret-down"} size={16} color={changeColor} />
          <Text style={[styles.changeText, { color: changeColor }]}>
            {isUp ? "+" : ""}{(summary?.change ?? 0).toFixed(2)} ({isUp ? "+" : ""}{(summary?.change_pct ?? 0).toFixed(2)}%)
          </Text>
          <Text style={styles.periodTag}>近 30 天</Text>
        </View>
      </View>

      {/* 迷你走勢圖（含 XY 軸） */}
      {chartData.length > 0 && (
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.sectionTitle}>📈 近 30 天走勢</Text>
            <View style={styles.priceRange}>
              <Text style={[styles.rangeText, { color: COLORS.green }]}>
                H ${maxPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </Text>
              <Text style={[styles.rangeText, { color: COLORS.red }]}>
                L ${minPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <LineChart
              data={chartData}
              width={Math.max(W - 80, chartData.length * 8)}
              height={140}
              color={isUp ? COLORS.green : COLORS.red}
              thickness={2}
              hideDataPoints
              curved
              initialSpacing={8}
              spacing={Math.max(8, Math.floor((W - 80) / chartData.length))}
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
              startFillColor={isUp ? COLORS.green : COLORS.red}
              startOpacity={0.15}
              endOpacity={0.0}
            />
          </ScrollView>
        </View>
      )}

      {/* 指標卡片 */}
      <Text style={styles.sectionTitle}>關鍵指標</Text>
      <View style={styles.grid}>
        <MetricCard label="區間最高" value={`$${(summary?.period_high ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`} />
        <MetricCard label="區間最低" value={`$${(summary?.period_low ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`} />
        <MetricCard label="RSI (14)" value={rsiVal.toFixed(1)} sub={rsiLabel} color={rsiColor} />
        <MetricCard
          label="MACD"
          value={(summary?.macd ?? 0).toFixed(0)}
          sub={`訊號 ${(summary?.macd_signal ?? 0).toFixed(0)}`}
          color={(summary?.macd ?? 0) > (summary?.macd_signal ?? 0) ? COLORS.green : COLORS.red}
        />
      </View>

      {/* 快速導覽 */}
      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>功能導覽</Text>
      <View style={styles.navGrid}>
        {[
          { label: "📈  詳細圖表", desc: "K線 / MA / RSI / 成交量", route: "/chart" },
          { label: "🎯  買賣訊號", desc: "多策略訊號分析",           route: "/signals" },
          { label: "💰  模擬回測", desc: "回測策略績效",             route: "/backtest" },
          { label: "🤖  投資顧問", desc: "AI 指標綜合建議",          route: "/advisor" },
        ].map((item) => (
          <TouchableOpacity key={item.route} style={styles.navCard} onPress={() => router.push(item.route as any)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.navLabel}>{item.label}</Text>
              <Text style={styles.navDesc}>{item.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.muted} />
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.bg },
  center:       { flex: 1, backgroundColor: COLORS.bg, justifyContent: "center", alignItems: "center", padding: 32 },
  loadingText:  { color: COLORS.muted, marginTop: 12 },
  errorText:    { color: COLORS.muted, marginTop: 16, textAlign: "center", lineHeight: 22 },
  retryBtn:     { marginTop: 20, backgroundColor: COLORS.primary, paddingHorizontal: 28, paddingVertical: 10, borderRadius: 8 },
  retryText:    { color: "#000", fontWeight: "bold" },
  priceCard:    { margin: 16, backgroundColor: COLORS.card, borderRadius: 16, padding: 20, alignItems: "center" },
  priceLabel:   { color: COLORS.muted, fontSize: 13, marginBottom: 4 },
  priceValue:   { color: COLORS.primary, fontSize: 34, fontWeight: "bold", letterSpacing: 1 },
  changeRow:    { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 4 },
  changeText:   { fontSize: 15, fontWeight: "600" },
  periodTag:    { color: COLORS.muted, fontSize: 12, marginLeft: 6 },
  chartCard:    { marginHorizontal: 16, marginBottom: 12, backgroundColor: COLORS.card, borderRadius: 16, padding: 16, overflow: "hidden" },
  chartHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  priceRange:   { flexDirection: "row", gap: 8 },
  rangeText:    { fontSize: 11, fontWeight: "600" },
  sectionTitle: { color: COLORS.text, fontSize: 15, fontWeight: "700", marginHorizontal: 16, marginBottom: 8 },
  axisText:     { color: COLORS.muted, fontSize: 9 },
  grid:         { flexDirection: "row", flexWrap: "wrap", marginHorizontal: 12, gap: 8 },
  metricCard:   { flex: 1, minWidth: "44%", backgroundColor: COLORS.card, borderRadius: 12, padding: 14 },
  metricLabel:  { color: COLORS.muted, fontSize: 11, marginBottom: 4 },
  metricValue:  { color: COLORS.text, fontSize: 20, fontWeight: "700" },
  metricSub:    { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  navGrid:      { marginHorizontal: 16, gap: 8, marginBottom: 8 },
  navCard:      { backgroundColor: COLORS.card, borderRadius: 12, padding: 16, flexDirection: "row", alignItems: "center" },
  navLabel:     { color: COLORS.text, fontSize: 15, fontWeight: "600" },
  navDesc:      { color: COLORS.muted, fontSize: 12, marginTop: 2 },
});
