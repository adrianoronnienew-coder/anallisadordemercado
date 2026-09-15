import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Input = z.object({
  image: z.string().min(100),
  timeframe: z.string().default("1min"),
  expirationMinutes: z.number().int().min(1).max(5).default(1),
  lessons: z.string().max(2000).optional(),
  stats: z
    .object({ wins: z.number(), losses: z.number() })
    .optional(),
});

const TechnicalReading = z.object({
  trend: z.string(),
  ema: z.string(),
  momentum: z.string(),
  volatility: z.string(),
  candlePattern: z.string(),
  supportResistance: z.string(),
  macd: z.string(),
  stochastic: z.string(),
  fibonacci: z.string(),
  volume: z.string(),
  score: z.number().min(0).max(10),
  bias: z.enum(["CALL", "PUT", "NEUTRAL"]),
  confluences: z.array(z.string()).max(10),
  warnings: z.array(z.string()).max(5),
  overlay: z.object({
    supportY: z.number().min(0).max(100).nullable(),
    resistanceY: z.number().min(0).max(100).nullable(),
    trendStart: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).nullable(),
    trendEnd: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).nullable(),
    entry: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).nullable(),
  }),
});

const AnalysisResponse = z.object({
  signal: z.enum(["CALL", "PUT", "WAIT"]),
  confidence: z.number().min(0).max(100),
  reason: z.string(),
  analysis: TechnicalReading,
});

const EMPTY_ANALYSIS = {
  trend: "Não identificada",
  ema: "Não identificada",
  momentum: "Não identificado",
  volatility: "Não identificada",
  candlePattern: "Nenhum padrão confirmado",
  supportResistance: "Zonas não identificadas",
  macd: "Não visível no gráfico",
  stochastic: "Não visível no gráfico",
  fibonacci: "Não identificável com segurança",
  volume: "Não visível no gráfico",
  score: 0,
  bias: "NEUTRAL" as const,
  confluences: [] as string[],
  warnings: ["Leitura técnica indisponível"],
  overlay: {
    supportY: null,
    resistanceY: null,
    trendStart: null,
    trendEnd: null,
    entry: null,
  },
};

export const analyzeFrame = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY não configurada");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3.8-flash");

    const statsBlock = data.stats
      ? `\n\nDESEMPENHO RECENTE: ${data.stats.wins} WINs / ${data.stats.losses} LOSSes. Se a taxa de acerto está baixa, aperte ainda mais os critérios.`
      : "";
    const lessonsBlock = data.lessons
      ? `\n\nAPRENDIZADO DE ORDENS ANTERIORES (evite repetir esses erros):\n${data.lessons}`
      : "";

    const prompt = `Você é um trader profissional de opções binárias de ${data.timeframe} com 15 anos de experiência combinando price action, indicadores técnicos e análise multi-timeframe. A expiração escolhida é de ${data.expirationMinutes} minuto(s): avalie se o movimento tem sustentação por todo esse horizonte. Prefira PERDER oportunidade a dar sinal ruim.

ATENÇÃO OTC: ativos "OTC" são sintéticos da corretora e revertem contra rompimentos "óbvios". Em OTC exija setup EXTRA claro e desconfie de movimentos amplos recentes — costumam ser armadilhas de liquidez.

===== ANÁLISE TÉCNICA MULTICAMADA =====
Antes de decidir, MENTALMENTE trace/estime cada camada abaixo olhando os pixels do gráfico:

A) ESTRUTURA DE MERCADO
   - Tendência dos últimos 20 candles: HH/HL (alta), LH/LL (baixa) ou lateral (range).
   - Identifique SUPORTE e RESISTÊNCIA visíveis (topos/fundos repetidos, zonas onde preço reagiu 2+ vezes).
   - Trace TRENDLINE ligando fundos ascendentes (alta) ou topos descendentes (baixa). Preço respeita ou rompeu?

B) MÉDIAS MÓVEIS ESTIMADAS
   - EMA rápida (~9 períodos): média dos últimos 9 fechamentos. Preço acima = viés compra, abaixo = venda.
   - EMA lenta (~21 períodos): direção geral. Cruzamento 9x21 = mudança de fase.
   - Distância preço vs EMA: muito esticado = risco de reversão/pullback.

C) MOMENTUM (RSI mental, 14 períodos)
   - Sequência de candles verdes/vermelhos e tamanho dos corpos.
   - RSI estimado >70 = sobrecompra (evite CALL), <30 = sobrevenda (evite PUT).
   - Divergência: preço faz novo topo mas momentum enfraquece (corpos menores) → reversão provável.

D) VOLATILIDADE (Bandas de Bollinger mentais)
   - Range dos últimos candles. Preço tocando extremo superior = reversão baixista provável, extremo inferior = alta.
   - Squeeze (candles pequenos comprimidos) = explosão iminente, aguarde direção.

E) PADRÕES DE CANDLE (últimos 3)
   - Engolfo alta/baixa, martelo, estrela cadente, pin bar, doji de indecisão, harami.
   - Pavios longos contra a direção pretendida = REJEIÇÃO, evite entrar a favor do corpo.

F) CANDLE ATUAL (em formação)
   - Corpo dominante (>60% do range) confirma direção. Pavio grande do lado oposto = fraqueza.
   - Posição dentro do candle: início/meio/perto do fechamento M1?

G) CONFIRMAÇÕES DOS E-BOOKS ENVIADOS
   - MACD: se estiver visível, valide cruzamento da linha de sinal, posição em relação ao zero e divergência. Se não estiver visível, declare isso; não invente valores.
   - Estocástico: se estiver visível, priorize cruzamentos de %K/%D nas zonas extremas (>80 ou <20). Se não estiver visível, declare isso.
   - Fibonacci: use 23,6%, 38,2%, 50%, 61,8% e 78,6% apenas quando houver um impulso e pivôs claramente identificáveis; nunca use Fibonacci sozinho.
   - Volume: quando visível, exija aumento de volume para confirmar rompimentos. Sem volume visível, não atribua confirmação.
   - Combine indicadores. RSI/Bollinger, médias, MACD, Estocástico ou Fibonacci isolados nunca autorizam entrada.
   - Os livros tratam IA como apoio e exigem dados históricos e validação humana; portanto não fabrique cálculos exatos a partir de pixels.

===== SCORE DE CONFLUÊNCIA =====
Some pontos a favor da direção pretendida. Só emita CALL/PUT se tiver **≥5 confluências alinhadas em pelo menos 3 categorias** e nenhum contra-sinal forte:
   - Estrutura a favor (+1)
   - Preço acima/abaixo da EMA9 na direção (+1)
   - EMA9 acima/abaixo da EMA21 na direção (+1)
   - Momentum saudável, não sobrecomprado/sobrevendido extremo (+1)
   - Padrão de candle confirmando (+1)
   - Candle atual com corpo dominante na direção (+1)
   - Distância adequada de S/R (não colado em zona contrária) (+1)
   - MACD ou Estocástico visível confirma a direção (+1)
   - Volume visível confirma ou há reação clara em Fibonacci (+1)
   - Entrada ocorre após rejeição/reteste, não no meio de um impulso esticado (+1)

Contra-sinais que ANULAM o trade mesmo com score alto:
   - Pavio grande contrário no candle atual
   - Divergência de momentum
   - Preço colado em suporte forte (para PUT) ou resistência forte (para CALL)
   - RSI extremo contra a direção
   - OTC com movimento recente >3 candles fortes seguidos (exaustão iminente)

===== REGRAS DE DECISÃO =====
- CALL: score ≥5, viés altista, sem contra-sinal, candle atual verde com corpo forte. Confidence 72-95 conforme força.
- PUT: score ≥5, viés baixista, sem contra-sinal, candle atual vermelho com corpo forte. Confidence 72-95.
- Score <5, lateral, doji, indecisão, sinais mistos, próximo de S/R contrário → WAIT.
- Na dúvida, SEMPRE WAIT. Um LOSS custa mais que 10 WAITs.${statsBlock}${lessonsBlock}

Retorne APENAS JSON válido (sem markdown, sem \`\`\`). Todos os textos devem ser curtos e em português:
As coordenadas do overlay são porcentagens (0 a 100) da imagem inteira. Posicione suporte e resistência na altura exata das zonas visíveis; a linha de tendência deve ligar dois pivôs reais; entry aponta para a vela atual. Use null quando não for possível localizar com segurança. Suporte, resistência e tendência são zonas estruturais: não os desloque por causa de uma única vela nova.

{"signal":"CALL"|"PUT"|"WAIT","confidence":0-100,"reason":"máx 16 palavras","analysis":{"trend":"HH/HL, LH/LL ou lateral + direção","ema":"posição e relação estimada EMA9/EMA21","momentum":"força, RSI mental e divergência","volatility":"expansão, normal ou squeeze","candlePattern":"padrão dos 3 últimos candles e candle atual","supportResistance":"zona mais próxima e risco","macd":"leitura visível ou não visível","stochastic":"leitura visível ou não visível","fibonacci":"nível relevante ou não identificável","volume":"confirmação visível ou não visível","score":0-10,"bias":"CALL"|"PUT"|"NEUTRAL","confluences":["evidências objetivas a favor"],"warnings":["contra-sinais encontrados"],"overlay":{"supportY":0-100|null,"resistanceY":0-100|null,"trendStart":{"x":0-100,"y":0-100}|null,"trendEnd":{"x":0-100,"y":0-100}|null,"entry":{"x":0-100,"y":0-100}|null}}}`;

    const start = Date.now();
    const result = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image", image: data.image },
          ],
        },
      ],
    });

    const latencyMs = Date.now() - start;
    let parsed: z.infer<typeof AnalysisResponse>;
    try {
      const cleaned = result.text.replace(/```json\s*|\s*```/g, "").trim();
      const checked = AnalysisResponse.safeParse(JSON.parse(cleaned));
      parsed = checked.success
        ? checked.data
        : {
            signal: "WAIT",
            confidence: 0,
            reason: "Resposta técnica incompleta",
            analysis: EMPTY_ANALYSIS,
          };
    } catch {
      parsed = {
        signal: "WAIT",
        confidence: 0,
        reason: "Falha ao interpretar resposta",
        analysis: EMPTY_ANALYSIS,
      };
    }
    return { ...parsed, latencyMs };
  });

const OutcomeInput = z.object({
  image: z.string().min(100),
  signal: z.enum(["CALL", "PUT"]),
  reason: z.string().max(300),
  expirationMinutes: z.number().int().min(1).max(5).default(1),
});

export const evaluateOutcome = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => OutcomeInput.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY não configurada");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3.8-flash");

    const prompt = `Você é um auditor de operações de opções binárias M1. Uma ordem foi aberta há ${data.expirationMinutes} minuto(s), com direção ${data.signal} (${data.signal === "CALL" ? "aposta em ALTA" : "aposta em BAIXA"}).
Motivo original: "${data.reason}".

Observe o gráfico atual. Compare o preço atual com o preço visual no momento da entrada, considerando a expiração de ${data.expirationMinutes} minuto(s):
- Se ${data.signal} = CALL e o candle fechou ACIMA da abertura (verde) → WIN
- Se ${data.signal} = PUT e o candle fechou ABAIXO da abertura (vermelho) → WIN
- Caso contrário → LOSS
- Se não conseguir identificar com certeza (candle indefinido, doji exato, tela obstruída) → UNKNOWN

Além disso, dê uma LIÇÃO curta (máx 18 palavras em português) do que aprendemos com esse trade — o que fez dar certo, ou qual sinal foi ignorado que fez dar errado. Se UNKNOWN, lição vazia.

Retorne APENAS JSON puro (sem markdown):
{"outcome":"WIN"|"LOSS"|"UNKNOWN","lesson":"..."}`;

    const result = await generateText({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image", image: data.image },
          ],
        },
      ],
    });

    let parsed: { outcome: "WIN" | "LOSS" | "UNKNOWN"; lesson: string };
    try {
      const cleaned = result.text.replace(/```json\s*|\s*```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { outcome: "UNKNOWN", lesson: "" };
    }
    return parsed;
  });
