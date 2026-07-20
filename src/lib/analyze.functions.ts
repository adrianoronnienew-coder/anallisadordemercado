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

    const prompt = `Você é um analista técnico especialista em opções binárias de ${data.timeframe}.
Analise o gráfico de candles mostrado nesta captura de tela (IQ Option ou similar).

Retorne APENAS um JSON válido (sem markdown, sem \`\`\`) neste formato exato:
{"signal":"CALL"|"PUT"|"WAIT","confidence":0-100,"reason":"máx 12 palavras em português"}

Regras:
- CALL = expectativa de alta no próximo candle
- PUT = expectativa de baixa no próximo candle
- WAIT = sem sinal claro, mercado lateral ou indefinido
- confidence: 0-100 baseado na força do setup
- Só recomende CALL/PUT com confidence >= 65
- Analise: tendência dos últimos candles, momentum, rompimentos, price action`;

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
