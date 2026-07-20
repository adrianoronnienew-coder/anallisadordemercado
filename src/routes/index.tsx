import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { analyzeFrame } from "@/lib/analyze.functions";
import { Play, Square, TrendingUp, TrendingDown, Minus, Volume2, VolumeX, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Signal Vision — Análise de tela em tempo real" },
      { name: "description", content: "Análise de gráficos em tempo real por IA através de compartilhamento de tela." },
    ],
  }),
});

type SignalKind = "CALL" | "PUT" | "WAIT";
type SignalRow = {
  id: string;
  ts: number;
  signal: SignalKind;
  confidence: number;
  reason: string;
  latencyMs: number;
};

function Index() {
  const analyze = useServerFn(analyzeFrame);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runningRef = useRef(false);
  const soundRef = useRef(true);
  const lastAlertRef = useRef<SignalKind | null>(null);
  const lockUntilRef = useRef<number>(0);

  const [sharing, setSharing] = useState(false);
  const [running, setRunning] = useState(false);
  const [sound, setSound] = useState(true);
  const [current, setCurrent] = useState<SignalRow | null>(null);
  const [history, setHistory] = useState<SignalRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [lockRemaining, setLockRemaining] = useState(0);

  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  const beep = useCallback((kind: SignalKind) => {
    if (!soundRef.current || kind === "WAIT") return;
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = kind === "CALL" ? 880 : 330;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  }, []);

  const stopSharing = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setSharing(false);
  }, []);

  const startSharing = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      });
      streamRef.current = stream;
      stream.getVideoTracks()[0].addEventListener("ended", stopSharing);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setSharing(true);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao compartilhar tela");
    }
  }, [stopSharing]);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return null;
    // Downscale para máxima velocidade: largura alvo 900px
    const targetW = Math.min(900, video.videoWidth);
    const scale = targetW / video.videoWidth;
    canvas.width = targetW;
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.6);
  }, []);

  const loop = useCallback(async () => {
    const MIN_INTERVAL_MS = 2500; // throttle p/ respeitar rate limit do gateway
    const CYCLE_LOCK_MS = 60000; // trava de 60s após CALL/PUT (ciclo M1)
    const MIN_CONFIDENCE = 75;
    let backoffMs = 0;
    while (runningRef.current) {
      const cycleStart = Date.now();

      // Trava de ciclo: enquanto sinal ativo, só decrementa contador
      if (lockUntilRef.current > Date.now()) {
        const remaining = Math.ceil((lockUntilRef.current - Date.now()) / 1000);
        setLockRemaining(remaining);
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      if (lockRemaining !== 0) setLockRemaining(0);

      const frame = captureFrame();
      if (!frame) {
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }
      setAnalyzing(true);
      try {
        const res = await analyze({ data: { image: frame, timeframe: "1min" } });
        setAnalyzing(false);
        setError(null);
        backoffMs = 0;

        // Downgrade abaixo do threshold — vira WAIT
        const signal: SignalKind =
          res.signal !== "WAIT" && res.confidence < MIN_CONFIDENCE ? "WAIT" : res.signal;

        const row: SignalRow = {
          id: crypto.randomUUID(),
          ts: Date.now(),
          signal,
          confidence: res.confidence,
          reason: signal === "WAIT" && res.signal !== "WAIT"
            ? `Confiança baixa (${res.confidence}%) — aguardando setup mais claro`
            : res.reason,
          latencyMs: res.latencyMs,
        };
        setCurrent(row);
        setHistory((h) => [row, ...h].slice(0, 30));

        if (signal !== "WAIT" && res.confidence >= MIN_CONFIDENCE) {
          beep(signal);
          lastAlertRef.current = signal;
          // Trava de ciclo — aguarda o M1 fechar antes de nova análise
          lockUntilRef.current = Date.now() + CYCLE_LOCK_MS;
          setLockRemaining(Math.ceil(CYCLE_LOCK_MS / 1000));
        } else {
          lastAlertRef.current = null;
        }
      } catch (e: any) {
        setAnalyzing(false);
        const msg = String(e?.message ?? "");
        const is429 = /429|too many|rate/i.test(msg);
        if (is429) {
          backoffMs = Math.min(backoffMs ? backoffMs * 2 : 4000, 30000);
          setError(`Rate limit atingido — aguardando ${Math.round(backoffMs / 1000)}s…`);
        } else {
          backoffMs = 1500;
          setError(msg || "Erro na análise");
        }
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
      const elapsed = Date.now() - cycleStart;
      if (elapsed < MIN_INTERVAL_MS) {
        await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - elapsed));
      }
    }
  }, [analyze, beep, captureFrame, lockRemaining]);

  const toggleRun = useCallback(() => {
    if (running) {
      runningRef.current = false;
      setRunning(false);
      return;
    }
    if (!sharing) return;
    runningRef.current = true;
    setRunning(true);
    lastAlertRef.current = null;
    lockUntilRef.current = 0;
    setLockRemaining(0);
    void loop();
  }, [running, sharing, loop]);

  useEffect(() => () => stopSharing(), [stopSharing]);

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white">
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
            <Zap className="h-5 w-5 text-black" strokeWidth={3} />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none">Signal Vision</h1>
            <p className="text-xs text-white/50 mt-0.5">Análise de tela em tempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSound((s) => !s)}
            className="text-white/70 hover:text-white hover:bg-white/5"
          >
            {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      <main className="grid grid-cols-12 gap-4 p-4">
        {/* Vídeo + controles */}
        <section className="col-span-12 lg:col-span-8 space-y-4">
          <div className="relative rounded-xl overflow-hidden bg-black border border-white/10 aspect-video">
            <video ref={videoRef} className="w-full h-full object-contain" muted playsInline />
            {!sharing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-900 to-black">
                <div className="text-center max-w-md px-6">
                  <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center mb-4">
                    <Play className="h-7 w-7 text-black ml-1" fill="currentColor" />
                  </div>
                  <h2 className="text-2xl font-bold">Compartilhe sua tela</h2>
                  <p className="text-white/60 mt-2 text-sm">
                    Selecione a janela da IQ Option (ou qualquer gráfico) para a IA analisar em tempo real.
                  </p>
                </div>
                <Button
                  onClick={startSharing}
                  size="lg"
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold"
                >
                  <Play className="h-4 w-4 mr-2" fill="currentColor" /> Compartilhar tela
                </Button>
              </div>
            )}
            {analyzing && sharing && (
              <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/70 backdrop-blur rounded-full px-3 py-1.5 text-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Analisando…
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {sharing && (
              <>
                <Button
                  onClick={toggleRun}
                  size="lg"
                  className={
                    running
                      ? "bg-red-500 hover:bg-red-400 text-white font-semibold flex-1"
                      : "bg-emerald-500 hover:bg-emerald-400 text-black font-semibold flex-1"
                  }
                >
                  {running ? (
                    <>
                      <Square className="h-4 w-4 mr-2" fill="currentColor" /> Parar análise
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" fill="currentColor" /> Iniciar análise
                    </>
                  )}
                </Button>
                <Button
                  onClick={stopSharing}
                  variant="outline"
                  size="lg"
                  className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
                >
                  Encerrar tela
                </Button>
              </>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
        </section>

        {/* Sinal atual + histórico */}
        <aside className="col-span-12 lg:col-span-4 space-y-4">
          <CurrentSignal row={current} analyzing={analyzing} lockRemaining={lockRemaining} />
          <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3">
              Histórico
            </h3>
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {history.length === 0 && (
                <p className="text-sm text-white/40">Sem sinais ainda.</p>
              )}
              {history.map((r) => (
                <HistoryRow key={r.id} row={r} />
              ))}
            </div>
          </div>
        </aside>
      </main>

      <canvas ref={canvasRef} className="hidden" />

      <footer className="px-6 py-4 text-center text-xs text-white/40 border-t border-white/5 mt-6">
        Ferramenta educacional. Sinais gerados por IA não são garantia de resultado. Opere por sua conta e risco.
      </footer>
    </div>
  );
}

function CurrentSignal({
  row,
  analyzing,
  lockRemaining,
}: {
  row: SignalRow | null;
  analyzing: boolean;
  lockRemaining: number;
}) {
  if (!row) {
    return (
      <div className="rounded-xl bg-white/[0.03] border border-white/10 p-6 text-center">
        <p className="text-sm text-white/40">
          {analyzing ? "Aguardando primeiro sinal…" : "Inicie a análise para receber sinais."}
        </p>
      </div>
    );
  }
  const isCall = row.signal === "CALL";
  const isPut = row.signal === "PUT";
  const bg = isCall
    ? "from-emerald-500/20 to-emerald-500/5 border-emerald-500/40"
    : isPut
      ? "from-red-500/20 to-red-500/5 border-red-500/40"
      : "from-white/5 to-transparent border-white/10";
  const Icon = isCall ? TrendingUp : isPut ? TrendingDown : Minus;
  const color = isCall ? "text-emerald-400" : isPut ? "text-red-400" : "text-white/60";

  return (
    <div className={`rounded-xl bg-gradient-to-br ${bg} border p-5`}>
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-white/50">Sinal atual</span>
        <span className="text-xs text-white/40">{row.latencyMs}ms</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Icon className={`h-10 w-10 ${color}`} strokeWidth={2.5} />
        <div>
          <div className={`text-4xl font-black ${color} leading-none`}>{row.signal}</div>
          <div className="text-sm text-white/60 mt-1">{row.confidence}% de confiança</div>
        </div>
      </div>
      <div className="mt-4 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={isCall ? "h-full bg-emerald-400" : isPut ? "h-full bg-red-400" : "h-full bg-white/30"}
          style={{ width: `${row.confidence}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-white/70">{row.reason}</p>
      {lockRemaining > 0 && (isCall || isPut) && (
        <div className="mt-4 flex items-center justify-between rounded-lg bg-black/40 border border-white/10 px-3 py-2">
          <span className="text-xs uppercase tracking-wider text-white/50">Aguardando fechamento M1</span>
          <span className={`text-lg font-bold tabular-nums ${color}`}>{lockRemaining}s</span>
        </div>
      )}
    </div>
  );
}

function HistoryRow({ row }: { row: SignalRow }) {
  const isCall = row.signal === "CALL";
  const isPut = row.signal === "PUT";
  const color = isCall ? "text-emerald-400" : isPut ? "text-red-400" : "text-white/50";
  const Icon = isCall ? TrendingUp : isPut ? TrendingDown : Minus;
  const time = new Date(row.ts).toLocaleTimeString("pt-BR", { hour12: false });
  return (
    <div className="flex items-center gap-3 rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2">
      <Icon className={`h-4 w-4 ${color}`} strokeWidth={2.5} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${color}`}>{row.signal}</span>
          <span className="text-xs text-white/40">{row.confidence}%</span>
        </div>
        <p className="text-xs text-white/50 truncate">{row.reason}</p>
      </div>
      <span className="text-[10px] text-white/30 tabular-nums">{time}</span>
    </div>
  );
}
