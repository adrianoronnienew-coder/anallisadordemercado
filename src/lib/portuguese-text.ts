// Keep service and stored signal codes unchanged; translate at presentation boundaries.
export function signalLabel(signal: string): string {
  return signal === "CALL" ? "COMPRA" : signal === "PUT" ? "VENDA" : "AGUARDAR";
}

export function outcomeLabel(outcome?: string | null): string {
  return outcome === "WIN" ? "VITÓRIA" : outcome === "LOSS" ? "DERROTA" : outcome === "UNKNOWN" ? "INDEFINIDO" : "PENDENTE";
}

const translations: Record<string, string> = {
  WAIT: "AGUARDAR", CALL: "COMPRA", PUT: "VENDA", WIN: "VITÓRIA", LOSS: "DERROTA",
  UNKNOWN: "INDEFINIDO", NEUTRAL: "NEUTRO", setup: "configuração", setups: "configurações",
  momentum: "força do movimento", score: "pontuação", checklist: "critérios",
  backtesting: "teste retrospectivo", backtest: "teste retrospectivo", candle: "vela", candles: "velas",
  pullback: "recuo", retest: "reteste", trendline: "linha de tendência", trend: "tendência",
  squeeze: "compressão", range: "faixa", breakout: "rompimento", trade: "operação", trades: "operações",
  bullish: "altista", bearish: "baixista", doji: "vela de indecisão", harami: "padrão de vela interna",
  "pin bar": "vela de rejeição", "price action": "movimento do preço", "stop loss": "limite de perda",
  EMA: "média móvel exponencial", RSI: "índice de força relativa", MACD: "convergência de médias móveis",
  ATR: "amplitude média real", ADX: "índice direcional médio", OTC: "mercado de balcão",
  HH: "topos mais altos", HL: "fundos mais altos", LH: "topos mais baixos", LL: "fundos mais baixos",
};
const terms = new RegExp(`\\b(${Object.keys(translations).sort((a, b) => b.length - a.length).join("|")})\\b`, "gi");

export function portugueseText(text: string): string {
  return text.replace(terms, (term) => translations[term] ?? translations[term.toUpperCase()] ?? translations[term.toLowerCase()] ?? term);
}