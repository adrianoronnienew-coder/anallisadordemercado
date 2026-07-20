import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Input = z.object({
  image: z.string().min(100), // data URL base64
  timeframe: z.string().default("1min"),
});

export const analyzeFrame = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY não configurada");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const prompt = `Você é um trader profissional de opções binárias de ${data.timeframe} com 15 anos de experiência em price action puro. Sua reputação depende de acertar. Prefira PERDER uma oportunidade a dar um sinal ruim.

Analise o gráfico de candles na imagem seguindo este checklist RIGOROSO, candle por candle:

1. TENDÊNCIA: Os últimos 8-12 candles mostram sequência clara de topos/fundos ascendentes (alta) ou descendentes (baixa)? Ou está lateralizado?
2. ÚLTIMOS 3 CANDLES: Qual a cor, tamanho do corpo e pavios? Há rejeição (pavio longo)? Doji? Engolfo?
3. MOMENTUM: O candle mais recente confirma a direção com corpo forte, ou está enfraquecendo?
4. CONTEXTO: Rompimento de suporte/resistência? Pullback numa tendência forte? Exaustão?
5. CONTRA-SINAIS: Há divergência, pavio de rejeição contra a direção pretendida, ou candle indeciso?

REGRAS DE DECISÃO (SEJA MUITO SELETIVO):
- Só emita CALL se: tendência de alta clara + candle atual verde forte + sem pavio superior grande + sem sinais de exaustão. Confidence mínimo 75.
- Só emita PUT se: tendência de baixa clara + candle atual vermelho forte + sem pavio inferior grande + sem sinais de exaustão. Confidence mínimo 75.
- Em QUALQUER dúvida, mercado lateral, candles pequenos/indecisos, próximo de S/R sem definição, ou setup fraco → WAIT com confidence baixo.
- É MELHOR emitir 10 WAITs seguidos do que 1 sinal ruim.

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
