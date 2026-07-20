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

    const prompt = `Você é um trader profissional de opções binárias de ${data.timeframe} com 15 anos de experiência em price action. Prefira PERDER uma oportunidade a dar sinal ruim.

ATENÇÃO OTC: Se o ativo terminar em "OTC" (mercado sintético da corretora, típico de fim de semana), o preço é gerado pela corretora e reverte contra movimentos aparentemente óbvios. Em OTC exija setup EXTRA claro e desconfie de rompimentos "fortes" — costumam ser armadilhas.

Checklist RIGOROSO:
1. TENDÊNCIA (últimos 10-15 candles): topos/fundos ascendentes, descendentes, ou lateral?
2. ÚLTIMOS 3 CANDLES: cor, corpo, pavios. Rejeição/Doji/Engolfo?
3. MOMENTUM: candle atual confirma direção com corpo forte, ou enfraquece?
4. CONTEXTO: rompimento confirmado de S/R, pullback saudável, ou exaustão/reversão?
5. CONTRA-SINAIS: divergências, pavios contrários, indecisão? → WAIT.
6. NÃO opere reversões contra tendência forte sem 2+ candles de confirmação.

REGRAS:
- CALL: tendência de alta clara + candle atual verde com corpo dominante (>60% do range) + sem pavio superior grande + momentum crescente. Confidence mínimo 72.
- PUT: tendência de baixa clara + candle atual vermelho com corpo dominante + sem pavio inferior grande + momentum crescente. Confidence mínimo 72.
- Lateral, doji, candle pequeno, próximo de S/R sem definição, sinais mistos, OTC ambíguo → WAIT.
- Na dúvida, SEMPRE WAIT. Melhor 10 WAITs do que 1 LOSS.${statsBlock}${lessonsBlock}

Retorne APENAS um JSON válido (sem markdown, sem \`\`\`):
{"signal":"CALL"|"PUT"|"WAIT","confidence":0-100,"reason":"máx 14 palavras em português explicando o setup"}`;

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
