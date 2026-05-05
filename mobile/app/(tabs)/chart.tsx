import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Dimensions,
} from "react-native";
import { LineChart, BarChart } from "react-native-gifted-charts";
import { getPrice, PriceRecord } from "../../services/api";
import { COLORS } from "../../constants/colors";

const W       = Dimensions.get("window").width;
const CHART_W = W - 32;          // 圖表總寬（含 y 軸）
const Y_WIDTH = 52;              // y 軸標籤寬
const INNER_W = CHART_W - Y_WIDTH; // 實際畫線區域寬

const PERIODS = [
  { label: "30天",  days: 30,  maxPts: 30  },
  { label: "90天",  days: 90,  maxPts: 60  },
  { label: "1年",   days: 365, maxPts: 80  },
  { label: "2年",   days: 730, maxPts: 80  },
];

const MA_OPTIONS = [
  { label: "MA5",   key: "ma5",   color: "#f6c90e" },
  { label: "MA20",  key: "ma20",  color: "#ff7f0e" },
  { label: "MA50",  key: "ma50",  color: "#2ca02c" },
  { label: "MA200", key: "ma200", color: "#9467bd" },
];

/** 向前填補 null，讓 MA 線不會從 0 竄起 */
function forwardFill(arr: (number | null)[]): number[] {
  let last = arr.find(v => v !== null) ?? 0;
  return arr.map(v => { if (v !== null) last = v; return last; });
}

/** 觸碰預覽卡片 */
function TooltipCard({ items, maList }: { items: any[]; maList: typeof MA_OPTIONS }) {
  if (!items?.length) return null;
  const d = items[0];
  if (!d?.date) return null;
  const isUp = (d.close ?? d.value) >= (d.open ?? d.value);
  return (
    <View style={tip.card}>
      <Text style={tip.date}>{d.date}</Text>
      <Text style={[tip.price, { color: isUp ? COLORS.green : COLORS.red }]}>
        ${(d.close ?? d.value)?.toLocaleString("en-US", { maximumFractionDigits: 0 })}
      </Text>
      {d.open != null && (
        <View style={tip.grid}>
          <View style={tip.cell}>
            <Text style={tip.lbl}>開</Text>
            <Text style={tip.val}>${d.open?.toLocaleString("en-US", { maximumFractionDigits: 0 })}</Text>
          </View>
          <View style={tip.cell}>
            <Text style={[tip.lbl, { color: COLORS.green }]}>高</Text>
            <Text style={[tip.val, { color: COLORS.green }]}>${d.high?.toLocaleString("en-US", { maximumFractionDigits: 0 })}</Text>
          </View>
          <View style={tip.cell}>
            <Text style={[tip.lbl, { color: COLORS.red }]}>低</Text>
            <Text style={[tip.val, { color: COLORS.red }]}>${d.low?.toLocaleString("en-US", { maximumFractionDigits: 0 })}</Text>
          </View>
        </View>
      )}
      {d.rsi != null && (
        <Text style={[tip.rsi, { color: d.rsi > 70 ? COLORS.red : d.rsi < 30 ? COLORS.green : COLORS.muted }]}>
          RSI {d.rsi?.toFixed(1)}
        </Text>
      )}
      {maList.filter(m => m.key in d).map(m => (
        <Text key={m.key} style={[tip.ma, { color: m.color }]}>
          {m.label} ${Number(d[m.key])?.toLocaleString("en-US", { maximumFractionDigits: 0 })}
        </Text>
      ))}
    </View>
  );
}

const tip = StyleSheet.create({
  card:  { backgroundColor: COLORS.card, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: COLORS.border, minWidth: 130 },
  date:  { color: COLORS.muted, fontSize: 10, marginBottom: 2 },
  price: { fontSize: 16, fontWeight: "800", marginBottom: 4 },
  grid:  { flexDirection: "row", gap: 6, marginBottom: 4 },
  cell:  { alignItems: "center" },
  lbl:   { color: COLORS.muted, fontSize: 9 },
  val:   { color: COLORS.text, fontSize: 11, fontWeight: "600" },
  rsi:   { fontSize: 10, fontWeight: "600", marginTop: 2 },
  ma:    { fontSize: 10, marginTop: 1 },
});

export default function ChartScreen() {
  const [periodIdx, setPeriodIdx] = useState(2);           // 預設「1年」
  const [data, setData]           = useState<PriceRecord[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [activeMAs, setActiveMAs] = useState<Set<string>>(new Set(["ma20", "ma50"]));
  const [showRSI, setShowRSI]     = useState(true);
  const [showVol, setShowVol]     = useState(false);

  const period = PERIODS[periodIdx];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPrice(period.days);
      setData(res.data);
      setError(null);
    } catch {
      setError("資料載入失敗");
    } finally {
      setLoading(false);
    }
  }, [period.days]);

  useEffect(() => { load(); }, [load]);

  const toggleMA = (key: string) =>
    setActiveMAs(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  // 取最後 maxPts 筆，讓 spacing 固定且夠大
  const visible = data.slice(-period.maxPts);
  const spacing = Math.floor(INNER_W / Math.max(visible.length, 1));
  // 每幾點顯示一個 x 軸標籤（約 6 個）
  const lblInterval = Math.max(1, Math.ceil(visible.length / 6));

  const activeMaList = MA_OPTIONS.filter(m => activeMAs.has(m.key));

  // 主價格線（帶完整 OHLC 供 tooltip 使用）
  const priceData = visible.map((d, i) => ({
    value:  d.close,
    date:   d.date,
    open:   d.open,
    high:   d.high,
    low:    d.low,
    rsi:    d.rsi,
    // MA 值也帶進去供 tooltip 顯示
    ...Object.fromEntries(activeMaList.map(m => [m.key, (d as any)[m.key]])),
    label:  i % lblInterval === 0 ? d.date.slice(5) : "",
    labelTextStyle: { color: COLORS.muted, fontSize: 9, width: 30, textAlign: "center" as const },
  }));

  // MA 線（等長，null 向前填補）
  const maDatasets = activeMaList.map(m =>
    forwardFill(visible.map(d => (d as any)[m.key] as number | null))
      .map(value => ({ value }))
  );

  // RSI 線
  const rsiData = visible.map((d, i) => ({
    value: d.rsi ?? 50,
    label: i % lblInterval === 0 ? d.date.slice(5) : "",
    labelTextStyle: { color: COLORS.muted, fontSize: 9, width: 30, textAlign: "center" as const },
  }));

  // 成交量
  const volData = visible.map((d, i) => ({
    value:       d.volume ?? 0,
    frontColor:  d.close >= d.open ? COLORS.green : COLORS.red,
    label:       i % lblInterval === 0 ? d.date.slice(5) : "",
    labelTextStyle: { color: COLORS.muted, fontSize: 9, width: 30, textAlign: "center" as const },
  }));

  const fmtY = (v: string) => `$${(Number(v) / 1000).toFixed(0)}k`;

  // 共用 pointerConfig
  const pointerCfg = (height: number) => ({
    pointerStripUptoDataPoint: true,
    pointerStripHeight:        height,
    pointerStripColor:         COLORS.muted + "66",
    pointerStripWidth:         1,
    pointerColor:              COLORS.primary,
    radius:                    5,
    pointerLabelWidth:         140,
    pointerLabelHeight:        130,
    activatePointersOnLongPress: false,
    autoAdjustPointerLabelPosition: true,
    pointerLabelComponent: (items: any[]) => (
      <TooltipCard items={items} maList={activeMaList} />
    ),
  });

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={s.muted}>載入中...</Text>
    </View>
  );

  if (error) return (
    <View style={s.center}>
      <Text style={s.errorText}>{error}</Text>
      <TouchableOpacity style={s.retryBtn} onPress={load}>
        <Text style={s.retryText}>重試</Text>
      </TouchableOpacity>
    </View>
  );

  const latest = data[data.length - 1];
  const rsiVal = latest?.rsi ?? 0;

  return (
    <ScrollView style={s.container}>

      {/* 時間區間 */}
      <View style={s.row}>
        {PERIODS.map((p, i) => (
          <TouchableOpacity
            key={p.days}
            style={[s.chip, periodIdx === i && s.chipActive]}
            onPress={() => setPeriodIdx(i)}
          >
            <Text style={[s.chipTxt, periodIdx === i && s.chipTxtActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 現價列 */}
      <View style={s.infoRow}>
        <View>
          <Text style={s.priceLbl}>現價</Text>
          <Text style={s.priceVal}>
            ${latest?.close?.toLocaleString("en-US", { minimumFractionDigits: 2 }) ?? "--"}
          </Text>
        </View>
        <Text style={[s.rsiVal, {
          color: rsiVal > 70 ? COLORS.red : rsiVal < 30 ? COLORS.green : COLORS.text
        }]}>
          RSI {rsiVal.toFixed(1)}{rsiVal > 70 ? " ⚠️" : rsiVal < 30 ? " 📉" : ""}
        </Text>
      </View>

      {/* MA 開關 */}
      <View style={s.row}>
        {MA_OPTIONS.map(m => {
          const on = activeMAs.has(m.key);
          return (
            <TouchableOpacity key={m.key}
              style={[s.maChip, on && { backgroundColor: m.color + "30", borderColor: m.color }]}
              onPress={() => toggleMA(m.key)}
            >
              <View style={[s.maDot, { backgroundColor: on ? m.color : COLORS.border }]} />
              <Text style={[s.maLbl, on && { color: m.color }]}>{m.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── 價格走勢圖 ── */}
      <View style={s.chartCard}>
        <Text style={s.secTitle}>📈 收盤價格  <Text style={s.hint}>（點擊查看詳情）</Text></Text>
        <LineChart
          data={priceData}
          data2={maDatasets[0]}
          data3={maDatasets[1]}
          data4={maDatasets[2]}
          data5={maDatasets[3]}
          color1={COLORS.primary}
          color2={activeMaList[0]?.color ?? "transparent"}
          color3={activeMaList[1]?.color ?? "transparent"}
          color4={activeMaList[2]?.color ?? "transparent"}
          color5={activeMaList[3]?.color ?? "transparent"}
          thickness1={2}
          thickness2={1.5} thickness3={1.5} thickness4={1.5} thickness5={1.5}
          width={CHART_W}
          height={220}
          spacing={spacing}
          initialSpacing={spacing / 2}
          hideDataPoints
          rotateLabel
          yAxisTextStyle={s.axisText}
          xAxisLabelTextStyle={s.axisText}
          rulesColor={COLORS.border}
          xAxisColor={COLORS.border}
          yAxisColor={COLORS.border}
          backgroundColor={COLORS.card}
          noOfSections={5}
          yAxisLabelWidth={Y_WIDTH}
          formatYLabel={fmtY}
          showVerticalLines
          verticalLinesColor={COLORS.border + "44"}
          pointerConfig={pointerCfg(220)}
        />
      </View>

      {/* ── RSI ── */}
      <TouchableOpacity onPress={() => setShowRSI(v => !v)} style={s.toggleRow}>
        <Text style={s.secTitle}>📊 RSI (14)</Text>
        <Text style={s.muted}>{showRSI ? "▲ 收起" : "▼ 展開"}</Text>
      </TouchableOpacity>
      {showRSI && (
        <View style={s.subCard}>
          <LineChart
            data={rsiData}
            color={COLORS.purple}
            thickness={1.5}
            width={CHART_W}
            height={120}
            spacing={spacing}
            initialSpacing={spacing / 2}
            hideDataPoints
            rotateLabel
            yAxisTextStyle={s.axisText}
            xAxisLabelTextStyle={s.axisText}
            rulesColor={COLORS.border}
            xAxisColor={COLORS.border}
            yAxisColor={COLORS.border}
            backgroundColor={COLORS.card}
            maxValue={100}
            noOfSections={4}
            yAxisLabelWidth={Y_WIDTH}
            showReferenceLine1
            referenceLine1Position={70}
            referenceLine1Config={{ color: COLORS.red,   dashWidth: 4, dashGap: 4 }}
            showReferenceLine2
            referenceLine2Position={30}
            referenceLine2Config={{ color: COLORS.green, dashWidth: 4, dashGap: 4 }}
            pointerConfig={{
              ...pointerCfg(120),
              pointerLabelHeight: 60,
              pointerLabelComponent: (items: any[]) => (
                <View style={tip.card}>
                  <Text style={tip.date}>{items[0]?.label || ""}</Text>
                  <Text style={[tip.price, {
                    color: items[0]?.value > 70 ? COLORS.red : items[0]?.value < 30 ? COLORS.green : COLORS.text
                  }]}>
                    RSI {items[0]?.value?.toFixed(1)}
                  </Text>
                  <Text style={tip.rsi}>
                    {items[0]?.value > 70 ? "超買區間 ⚠️" : items[0]?.value < 30 ? "超賣區間 📉" : "中性區間"}
                  </Text>
                </View>
              ),
            }}
          />
          <View style={s.legend}>
            <Text style={{ color: COLORS.red,   fontSize: 10 }}>── 超買 (70)</Text>
            <Text style={{ color: COLORS.green, fontSize: 10 }}>── 超賣 (30)</Text>
          </View>
        </View>
      )}

      {/* ── 成交量 ── */}
      <TouchableOpacity onPress={() => setShowVol(v => !v)} style={s.toggleRow}>
        <Text style={s.secTitle}>📦 成交量</Text>
        <Text style={s.muted}>{showVol ? "▲ 收起" : "▼ 展開"}</Text>
      </TouchableOpacity>
      {showVol && (
        <View style={s.subCard}>
          <BarChart
            data={volData}
            width={CHART_W}
            height={100}
            barWidth={Math.max(3, spacing - 2)}
            spacing={Math.max(1, spacing - Math.max(3, spacing - 2) - 1)}
            initialSpacing={spacing / 2}
            rotateLabel
            yAxisTextStyle={s.axisText}
            xAxisLabelTextStyle={s.axisText}
            rulesColor={COLORS.border}
            xAxisColor={COLORS.border}
            yAxisColor={COLORS.border}
            backgroundColor={COLORS.card}
            noOfSections={3}
            yAxisLabelWidth={Y_WIDTH}
            formatYLabel={(v) => `${(Number(v) / 1e9).toFixed(1)}B`}
          />
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.bg },
  center:      { flex: 1, backgroundColor: COLORS.bg, justifyContent: "center", alignItems: "center" },
  muted:       { color: COLORS.muted, fontSize: 12 },
  errorText:   { color: COLORS.red, fontSize: 14 },
  retryBtn:    { marginTop: 12, backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 8, borderRadius: 8 },
  retryText:   { color: "#000", fontWeight: "bold" },
  row:         { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexWrap: "wrap" },
  chip:        { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  chipActive:  { backgroundColor: COLORS.primary + "22", borderColor: COLORS.primary },
  chipTxt:     { color: COLORS.muted, fontSize: 13 },
  chipTxtActive:{ color: COLORS.primary, fontWeight: "600" },
  maChip:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, gap: 4 },
  maDot:       { width: 8, height: 8, borderRadius: 4 },
  maLbl:       { color: COLORS.muted, fontSize: 12 },
  infoRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginHorizontal: 16, marginBottom: 4, backgroundColor: COLORS.card, borderRadius: 12, padding: 14 },
  priceLbl:    { color: COLORS.muted, fontSize: 11 },
  priceVal:    { color: COLORS.primary, fontSize: 22, fontWeight: "bold" },
  rsiVal:      { fontSize: 16, fontWeight: "700" },
  chartCard:   { marginHorizontal: 16, marginBottom: 8, backgroundColor: COLORS.card, borderRadius: 12, padding: 12, overflow: "hidden" },
  subCard:     { marginHorizontal: 16, marginBottom: 8, backgroundColor: COLORS.card, borderRadius: 12, padding: 12, overflow: "hidden" },
  secTitle:    { color: COLORS.text, fontSize: 13, fontWeight: "700", marginBottom: 8 },
  hint:        { color: COLORS.muted, fontSize: 10, fontWeight: "400" },
  axisText:    { color: COLORS.muted, fontSize: 9 },
  toggleRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginHorizontal: 16, marginTop: 6, marginBottom: 2 },
  legend:      { flexDirection: "row", gap: 12, justifyContent: "flex-end", marginTop: 4 },
});
