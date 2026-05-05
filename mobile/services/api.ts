import axios from "axios";
import { API_BASE_URL } from "../constants/config";

const api = axios.create({ baseURL: API_BASE_URL, timeout: 30000 });

export interface PriceRecord {
  date: string; open: number; high: number; low: number; close: number;
  volume: number; ma5: number | null; ma10: number | null;
  ma20: number | null; ma50: number | null; ma200: number | null;
  rsi: number | null; macd: number | null; macd_signal: number | null;
  macd_hist: number | null; bb_upper: number | null; bb_lower: number | null;
}

export interface PriceSummary {
  latest_price: number; change: number; change_pct: number;
  period_high: number; period_low: number; rsi: number;
  macd: number; macd_signal: number;
}

export interface SignalRecord {
  date: string; close: number; signal: number; rsi: number | null;
  ma20: number | null; ma50: number | null;
}

export interface BacktestMetrics {
  total_return: number; bh_return: number; win_rate: number;
  trade_count: number; sharpe: number; mdd: number; final_capital: number;
}

export interface TradeRecord {
  date: string; action: string; price: number; quantity: number;
  pnl: number | null; pnl_pct: string; capital: number;
}

export const getPrice = async (days = 365) => {
  const { data } = await api.get<{ data: PriceRecord[]; summary: PriceSummary }>(
    `/api/price?days=${days}`
  );
  return data;
};

export const getSignals = async (params: {
  days?: number; strategy?: string;
  fast?: number; slow?: number; rsi_low?: number; rsi_high?: number;
}) => {
  const { data } = await api.get<{
    data: SignalRecord[];
    stats: { buy_count: number; sell_count: number; avg_ret_7d: number; win_rate_7d: number };
  }>("/api/signals", { params });
  return data;
};

export const getAdvisor = async () => {
  const { data } = await api.get("/api/advisor");
  return data;
};

export const runBacktest = async (params: {
  days?: number; strategy?: string; fast?: number; slow?: number;
  rsi_low?: number; rsi_high?: number; initial_capital?: number;
  stop_loss?: number; take_profit?: number; fee?: number;
}) => {
  const { data } = await api.post<{
    metrics: BacktestMetrics;
    equity: { date: string; value: number }[];
    trades: TradeRecord[];
  }>("/api/backtest", params);
  return data;
};
