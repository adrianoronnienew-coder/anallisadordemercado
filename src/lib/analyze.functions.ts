import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Input = z.object({
  image: z.string().min(100),
  timeframe: z.string().default("1min"),
  lessons: z.string().max(2000).optional(),
  stats: z
    .object({ wins: z.number(), losses: z.number() })
    .optional(),
});

export const analyzeFrame = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY não configurada");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const statsBlock = data.stats
      ? `\n\nDESEMPENHO RECENTE: ${data.stats.wins} WINs / ${data.stats.losses} LOSSes. Se a taxa de acerto está baixa, aperte ainda mais os critérios.`
      : "";
    const lessonsBlock = data.lessons
      ? `\n\nAPRENDIZADO DE ORDENS ANTERIORES (evite repetir esses erros):\n${data.lessons}`
      : "";

    const prompt = `Você é um trader profissional de opções binárias de ${data.timeframe} com 15 anos de experiência combinando price action, indicadores técnicos e análise multi-timeframe. Prefira PERDER oportunidade a dar sinal ruim.

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

===== SCORE DE CONFLUÊNCIA =====
Some pontos a favor da direção pretendida (A-F). Só emita CALL/PUT se tiver **≥4 confluências alinhadas** e nenhum contra-sinal forte:
   - Estrutura a favor (+1)
   - Preço acima/abaixo da EMA9 na direção (+1)
   - EMA9 acima/abaixo da EMA21 na direção (+1)
   - Momentum saudável, não sobrecomprado/sobrevendido extremo (+1)
   - Padrão de candle confirmando (+1)
   - Candle atual com corpo dominante na direção (+1)
   - Distância adequada de S/R (não colado em zona contrária) (+1)

Contra-sinais que ANULAM o trade mesmo com score alto:
   - Pavio grande contrário no candle atual
   - Divergência de momentum
   - Preço colado em suporte forte (para PUT) ou resistência forte (para CALL)
   - RSI extremo contra a direção
   - OTC com movimento recente >3 candles fortes seguidos (exaustão iminente)

===== REGRAS DE DECISÃO =====
- CALL: score ≥4, viés altista, sem contra-sinal, candle atual verde com corpo forte. Confidence 72-95 conforme força.
- PUT: score ≥4, viés baixista, sem contra-sinal, candle atual vermelho com corpo forte. Confidence 72-95.
- Score <4, lateral, doji, indecisão, sinais mistos, próximo de S/R contrário → WAIT.
- Na dúvida, SEMPRE WAIT. Um LOSS custa mais que 10 WAITs.${statsBlock}${lessonsBlock}

Retorne APENAS JSON válido (sem markdown, sem \`\`\`):
{"signal":"CALL"|"PUT"|"WAIT","confidence":0-100,"reason":"máx 16 palavras citando as principais confluências (ex: EMA9>EMA21, engolfo, rompeu resistência)"}`;

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
    let parsed: { signal: "CALL" | "PUT" | "WAIT"; confidence: number; reason: string };
    try {
      const cleaned = result.text.replace(/```json\s*|\s*```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { signal: "WAIT", confidence: 0, reason: "Falha ao interpretar resposta" };
    }
    return { ...parsed, latencyMs };
  });

const OutcomeInput = z.object({
  image: z.string().min(100),
  signal: z.enum(["CALL", "PUT"]),
  reason: z.string().max(300),
});

export const evaluateOutcome = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => OutcomeInput.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY não configurada");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const prompt = `Você é um auditor de operações de opções binárias M1. Uma ordem foi aberta a 1 minuto atrás com direção ${data.signal} (${data.signal === "CALL" ? "aposta em ALTA" : "aposta em BAIXA"}).
Motivo original: "${data.reason}".

Observe o gráfico atual. O último candle FECHADO (o mais à direita já concluído) representa o resultado da operação:
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
