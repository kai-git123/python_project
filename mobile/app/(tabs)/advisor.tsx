import React, { useState, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  ActivityIndicator, TouchableOpacity, Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { API_BASE_URL } from "../../constants/config";
import { COLORS } from "../../constants/colors";

const W = Dimensions.get("window").width;

interface Signal {
  indicator: string;
  signal:    string;
  desc:      string;
  score:     number;
  type:      "buy" | "sell" | "neutral";
}

interface AdvisorResult {
  recommendation: string;
  rec_type:       string;
  rec_emoji:      string;
  score:          number;
  confidence:     number;
  buy_signals:    number;
  sell_signals:   number;
  signals:        Signal[];
  current_price:  number;
  rsi:            number;
  ret7d:          number | null;
  ret30d:         number | null;
  analysis_date:  string;
}

const REC_COLORS: Record<string, string> = {
  strong_buy:  "#00c853",
  buy:         COLORS.green,
  hold:        COLORS.primary,
  sell:        COLORS.red,
  strong_sell: "#b71c1c",
};

function ScoreBar({ score }: { score: number }) {
  // score range -11 to +11, map to 0-100%
  const pct    = ((score + 11) / 22) * 100;
  const clamp  = Math.max(0, Math.min(100, pct));
  const color  = score >= 2 ? COLORS.green : score <= -2 ? COLORS.red : COLORS.primary;
  return (
    <View style={bar.wrap}>
      <View style={bar.track}>
        <View style={[bar.center]} />
        <View style={[bar.fill, { width: `${clamp}%`, backgroundColor: color }]} />
        <View style={bar.indicator} />
      </View>
      <View style={bar.labels}>
        <Text style={bar.lbl}>強烈賣出</Text>
        <Text style={bar.lbl}>觀望</Text>
        <Text style={bar.lbl}>強烈買入</Text>
      </View>
    </View>
  );
}

const bar = StyleSheet.create({
  wrap:      { marginVertical: 12 },
  track:     { height: 10, backgroundColor: COLORS.border, borderRadius: 5, overflow: "hidden" },
  center:    { position: "absolute", left: "50%", top: 0, width: 2, height: "100%", backgroundColor: COLORS.muted + "88" },
  fill:      { height: "100%", borderRadius: 5 },
  indicator: {},
  labels:    { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  lbl:       { color: COLORS.muted, fontSize: 9 },
});

function SignalCard({ item }: { item: Signal }) {
  const color = item.type === "buy" ? COLORS.green : item.type === "sell" ? COLORS.red : COLORS.muted;
  const bg    = item.type === "buy" ? COLORS.green + "15" : item.type === "sell" ? COLORS.red + "15" : COLORS.border + "33";
  return (
    <View style={[sig.card, { backgroundColor: bg, borderLeftColor: color }]}>
      <View style={sig.header}>
        <Text style={sig.indicator}>{item.indicator}</Text>
        <View style={[sig.badge, { backgroundColor: color + "22" }]}>
          <Text style={[sig.badgeText, { color }]}>{item.signal}</Text>
        </View>
        <Text style={[sig.scoreText, { color }]}>
          {item.score > 0 ? `+${item.score}` : item.score}
        </Text>
      </View>
      <Text style={sig.desc}>{item.desc}</Text>
    </View>
  );
}

const sig = StyleSheet.create({
  card:       { borderRadius: 10, padding: 12, marginBottom: 8, borderLeftWidth: 3 },
  header:     { flexDirection: "row", alignItems: "center", marginBottom: 4, gap: 8 },
  indicator:  { color: COLORS.text, fontSize: 13, fontWeight: "700", flex: 1 },
  badge:      { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText:  { fontSize: 11, fontWeight: "600" },
  scoreText:  { fontSize: 14, fontWeight: "800", minWidth: 28, textAlign: "right" },
  desc:       { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
});

export default function AdvisorScreen() {
  const [result, setResult]   = useState<AdvisorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get<AdvisorResult>(`${API_BASE_URL}/api/advisor`, { timeout: 30000 });
      setResult(data);
    } catch {
      setError("分析失敗，請確認伺服器已啟動");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>AI 分析中...</Text>
        <Text style={styles.loadingSub}>正在評估 5 項技術指標</Text>
      </View>
    );
  }

  if (error || !result) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.muted} />
        <Text style={styles.errorText}>{error ?? "尚未分析"}</Text>
        <TouchableOpacity style={styles.analyzeBtn} onPress={load}>
          <Text style={styles.analyzeBtnText}>重新分析</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const recColor = REC_COLORS[result.rec_type] ?? COLORS.primary;

  return (
    <ScrollView style={styles.container}>

      {/* 主建議卡片 */}
      <View style={[styles.recCard, { borderColor: recColor }]}>
        <Text style={styles.recEmoji}>{result.rec_emoji}</Text>
        <Text style={[styles.recText, { color: recColor }]}>{result.recommendation}</Text>
        <Text style={styles.recPrice}>
          ${result.current_price?.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </Text>
        <Text style={styles.recDate}>分析日期：{result.analysis_date}</Text>
        <View style={styles.confidenceRow}>
          <Text style={styles.confidenceLabel}>信心指數</Text>
          <View style={styles.confidenceBar}>
            <View style={[styles.confidenceFill, { width: `${result.confidence}%`, backgroundColor: recColor }]} />
          </View>
          <Text style={[styles.confidenceVal, { color: recColor }]}>{result.confidence}%</Text>
        </View>
      </View>

      {/* 評分儀表 */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>綜合評分</Text>
        <View style={styles.scoreRow}>
          <Text style={[styles.scoreVal, { color: recColor }]}>
            {result.score > 0 ? `+${result.score}` : result.score}
          </Text>
          <Text style={styles.scoreMax}> / 11</Text>
        </View>
        <ScoreBar score={result.score} />
        <View style={styles.sigCountRow}>
          <View style={styles.sigCount}>
            <Text style={[styles.sigNum, { color: COLORS.green }]}>{result.buy_signals}</Text>
            <Text style={styles.sigLbl}>看多訊號</Text>
          </View>
          <View style={styles.sigDivider} />
          <View style={styles.sigCount}>
            <Text style={[styles.sigNum, { color: COLORS.red }]}>{result.sell_signals}</Text>
            <Text style={styles.sigLbl}>看空訊號</Text>
          </View>
          <View style={styles.sigDivider} />
          <View style={styles.sigCount}>
            <Text style={[styles.sigNum, { color: COLORS.muted }]}>
              {result.signals.length - result.buy_signals - result.sell_signals}
            </Text>
            <Text style={styles.sigLbl}>中性訊號</Text>
          </View>
        </View>
      </View>

      {/* 近期報酬 */}
      <View style={styles.retCard}>
        {[
          { label: "近 7 日報酬", val: result.ret7d },
          { label: "近 30 日報酬", val: result.ret30d },
          { label: "RSI (14)", val: null, raw: result.rsi?.toFixed(1) ?? "--" },
        ].map((item, i) => (
          <View key={i} style={styles.retItem}>
            <Text style={styles.retLabel}>{item.label}</Text>
            {item.raw ? (
              <Text style={[styles.retVal, {
                color: Number(item.raw) > 70 ? COLORS.red : Number(item.raw) < 30 ? COLORS.green : COLORS.text
              }]}>{item.raw}</Text>
            ) : (
              <Text style={[styles.retVal, {
                color: (item.val ?? 0) >= 0 ? COLORS.green : COLORS.red
              }]}>
                {item.val != null ? `${item.val >= 0 ? "+" : ""}${item.val.toFixed(2)}%` : "--"}
              </Text>
            )}
          </View>
        ))}
      </View>

      {/* 指標明細 */}
      <Text style={styles.sectionTitle}>📋 指標分析明細</Text>
      <View style={styles.signalList}>
        {result.signals.map((s, i) => <SignalCard key={i} item={s} />)}
      </View>

      {/* 免責聲明 */}
      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={14} color={COLORS.muted} />
        <Text style={styles.disclaimerText}>
          本分析僅供參考，不構成投資建議。加密貨幣投資具高風險，請自行判斷。
        </Text>
      </View>

      {/* 重新分析 */}
      <TouchableOpacity style={styles.refreshBtn} onPress={load}>
        <Ionicons name="refresh" size={16} color={COLORS.primary} />
        <Text style={styles.refreshText}>重新分析</Text>
      </TouchableOpacity>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: COLORS.bg },
  center:          { flex: 1, backgroundColor: COLORS.bg, justifyContent: "center", alignItems: "center", padding: 32 },
  loadingText:     { color: COLORS.text, fontSize: 16, fontWeight: "600", marginTop: 16 },
  loadingSub:      { color: COLORS.muted, fontSize: 13, marginTop: 4 },
  errorText:       { color: COLORS.muted, textAlign: "center", marginTop: 12, lineHeight: 20 },
  analyzeBtn:      { marginTop: 20, backgroundColor: COLORS.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 },
  analyzeBtnText:  { color: "#000", fontWeight: "bold", fontSize: 15 },
  recCard:         { margin: 16, backgroundColor: COLORS.card, borderRadius: 16, padding: 20, alignItems: "center", borderWidth: 2 },
  recEmoji:        { fontSize: 48, marginBottom: 8 },
  recText:         { fontSize: 28, fontWeight: "900", letterSpacing: 1 },
  recPrice:        { color: COLORS.muted, fontSize: 16, marginTop: 4 },
  recDate:         { color: COLORS.muted, fontSize: 11, marginTop: 2, marginBottom: 12 },
  confidenceRow:   { flexDirection: "row", alignItems: "center", width: "100%", gap: 8 },
  confidenceLabel: { color: COLORS.muted, fontSize: 12, width: 56 },
  confidenceBar:   { flex: 1, height: 8, backgroundColor: COLORS.border, borderRadius: 4, overflow: "hidden" },
  confidenceFill:  { height: "100%", borderRadius: 4 },
  confidenceVal:   { fontSize: 13, fontWeight: "700", width: 40, textAlign: "right" },
  card:            { marginHorizontal: 16, marginBottom: 12, backgroundColor: COLORS.card, borderRadius: 12, padding: 16 },
  cardTitle:       { color: COLORS.text, fontSize: 14, fontWeight: "700", marginBottom: 8 },
  scoreRow:        { flexDirection: "row", alignItems: "baseline" },
  scoreVal:        { fontSize: 40, fontWeight: "900" },
  scoreMax:        { color: COLORS.muted, fontSize: 18 },
  sigCountRow:     { flexDirection: "row", justifyContent: "space-around", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  sigCount:        { alignItems: "center" },
  sigNum:          { fontSize: 22, fontWeight: "800" },
  sigLbl:          { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  sigDivider:      { width: 1, backgroundColor: COLORS.border },
  retCard:         { marginHorizontal: 16, marginBottom: 12, backgroundColor: COLORS.card, borderRadius: 12, padding: 16, flexDirection: "row", justifyContent: "space-around" },
  retItem:         { alignItems: "center" },
  retLabel:        { color: COLORS.muted, fontSize: 11, marginBottom: 4 },
  retVal:          { fontSize: 18, fontWeight: "700" },
  sectionTitle:    { color: COLORS.text, fontSize: 15, fontWeight: "700", marginHorizontal: 16, marginBottom: 8 },
  signalList:      { marginHorizontal: 16 },
  disclaimer:      { flexDirection: "row", marginHorizontal: 16, marginTop: 16, gap: 6, alignItems: "flex-start" },
  disclaimerText:  { color: COLORS.muted, fontSize: 11, flex: 1, lineHeight: 16 },
  refreshBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 16, gap: 6 },
  refreshText:     { color: COLORS.primary, fontSize: 14, fontWeight: "600" },
});
