import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { analyzeFrame, evaluateOutcome } from "@/lib/analyze.functions";
import {
  Play,
  Square,
  TrendingUp,
  TrendingDown,
  Minus,
  Volume2,
  VolumeX,
  Zap,
  Check,
  X,
  HelpCircle,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Signal Vision — Análise de tela em tempo real" },
      {
        name: "description",
        content: "Análise de gráficos em tempo real por IA através de compartilhamento de tela.",
      },
    ],
  }),
});

type SignalKind = "CALL" | "PUT" | "WAIT";
type Outcome = "WIN" | "LOSS" | "UNKNOWN" | null;
type SignalRow = {
  id: string;
  ts: number;
  signal: SignalKind;
  confidence: number;
  reason: string;
  latencyMs: number;
  outcome?: Outcome;
  lesson?: string;
};

const LESSONS_KEY = "sv_lessons_v1";
const STATS_KEY = "sv_stats_v1";
const MAX_LESSONS = 6;

function loadLessons(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LESSONS_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveLessons(l: string[]) {
  try {
    localStorage.setItem(LESSONS_KEY, JSON.stringify(l.slice(-MAX_LESSONS)));
  } catch {}
}
function loadStats(): { wins: number; losses: number } {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY) || '{"wins":0,"losses":0}');
  } catch {
    return { wins: 0, losses: 0 };
  }
}
function saveStats(s: { wins: number; losses: number }) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(s));
  } catch {}
}

function Index() {
  const analyze = useServerFn(analyzeFrame);
  const evaluate = useServerFn(evaluateOutcome);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runningRef = useRef(false);
  const soundRef = useRef(true);
  const lockUntilRef = useRef<number>(0);
  const lessonsRef = useRef<string[]>([]);
  const statsRef = useRef<{ wins: number; losses: number }>({ wins: 0, losses: 0 });
  const pendingTradeRef = useRef<SignalRow | null>(null);
  const evaluateAtRef = useRef<number>(0);

  const [sharing, setSharing] = useState(false);
  const [running, setRunning] = useState(false);
  const [sound, setSound] = useState(true);
  const [current, setCurrent] = useState<SignalRow | null>(null);
  const [history, setHistory] = useState<SignalRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [lockRemaining, setLockRemaining] = useState(0);
  const [stats, setStats] = useState<{ wins: number; losses: number }>({ wins: 0, losses: 0 });

  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  useEffect(() => {
    lessonsRef.current = loadLessons();
    const s = loadStats();
    statsRef.current = s;
    setStats(s);
  }, []);

  // ==== Efeitos sonoros ====
  const playTone = useCallback(
    (steps: { freq: number; dur: number; delay: number; type?: OscillatorType; gain?: number }[]) => {
      if (!soundRef.current) return;
      try {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AC();
        const now = ctx.currentTime;
        steps.forEach((s) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = s.type ?? "sine";
          osc.frequency.setValueAtTime(s.freq, now + s.delay);
          osc.connect(g);
          g.connect(ctx.destination);
          const peak = s.gain ?? 0.25;
          g.gain.setValueAtTime(0.0001, now + s.delay);
          g.gain.exponentialRampToValueAtTime(peak, now + s.delay + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, now + s.delay + s.dur);
          osc.start(now + s.delay);
          osc.stop(now + s.delay + s.dur + 0.02);
        });
      } catch {}
    },
    [],
  );

  const alertCall = useCallback(
    () =>
      playTone([
        { freq: 660, dur: 0.12, delay: 0 },
        { freq: 880, dur: 0.12, delay: 0.13 },
        { freq: 1175, dur: 0.22, delay: 0.26 },
      ]),
    [playTone],
  );
  const alertPut = useCallback(
    () =>
      playTone([
        { freq: 660, dur: 0.12, delay: 0 },
        { freq: 494, dur: 0.12, delay: 0.13 },
        { freq: 330, dur: 0.22, delay: 0.26 },
      ]),
    [playTone],
  );
  const alertWin = useCallback(
    () =>
      playTone([
        { freq: 784, dur: 0.1, delay: 0, type: "triangle" },
        { freq: 988, dur: 0.1, delay: 0.1, type: "triangle" },
        { freq: 1319, dur: 0.28, delay: 0.2, type: "triangle", gain: 0.3 },
      ]),
    [playTone],
  );
  const alertLoss = useCallback(
    () =>
      playTone([
        { freq: 300, dur: 0.18, delay: 0, type: "sawtooth", gain: 0.18 },
        { freq: 200, dur: 0.28, delay: 0.19, type: "sawtooth", gain: 0.18 },
      ]),
    [playTone],
  );

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
    const targetW = Math.min(900, video.videoWidth);
    const scale = targetW / video.videoWidth;
    canvas.width = targetW;
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.6);
  }, []);

  const runEvaluation = useCallback(async () => {
    const pending = pendingTradeRef.current;
    if (!pending) return;
    const frame = captureFrame();
    if (!frame) return;
    try {
      const res = await evaluate({
        data: {
          image: frame,
          signal: pending.signal as "CALL" | "PUT",
          reason: pending.reason,
        },
      });
      // Atualiza histórico e sinal atual
      setHistory((h) =>
        h.map((r) => (r.id === pending.id ? { ...r, outcome: res.outcome, lesson: res.lesson } : r)),
      );
      setCurrent((c) =>
        c && c.id === pending.id ? { ...c, outcome: res.outcome, lesson: res.lesson } : c,
      );

      if (res.outcome === "WIN") {
        statsRef.current = { ...statsRef.current, wins: statsRef.current.wins + 1 };
        alertWin();
      } else if (res.outcome === "LOSS") {
        statsRef.current = { ...statsRef.current, losses: statsRef.current.losses + 1 };
        alertLoss();
      }
      saveStats(statsRef.current);
      setStats({ ...statsRef.current });

      if (res.lesson) {
        const tag = res.outcome === "WIN" ? "[WIN]" : res.outcome === "LOSS" ? "[LOSS]" : "[?]";
        const line = `${tag} ${pending.signal} — ${res.lesson}`;
        lessonsRef.current = [...lessonsRef.current, line].slice(-MAX_LESSONS);
        saveLessons(lessonsRef.current);
      }
    } catch {
      // silencioso; se falhar, segue vida
    } finally {
      pendingTradeRef.current = null;
    }
  }, [captureFrame, evaluate, alertWin, alertLoss]);

  const loop = useCallback(async () => {
    const MIN_INTERVAL_MS = 2500;
    const CYCLE_LOCK_MS = 60000;
    const MIN_CONFIDENCE = 75;
    let backoffMs = 0;

    while (runningRef.current) {
      const cycleStart = Date.now();

      // Trava de ciclo — durante o M1 da ordem aberta, apenas espera
      if (lockUntilRef.current > Date.now()) {
        const remaining = Math.ceil((lockUntilRef.current - Date.now()) / 1000);
        setLockRemaining(remaining);
        // Ao expirar, dispara avaliação da ordem
        if (evaluateAtRef.current && Date.now() >= evaluateAtRef.current) {
          evaluateAtRef.current = 0;
          void runEvaluation();
        }
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      if (lockRemaining !== 0) setLockRemaining(0);

      // Garante que a avaliação rode ao sair do lock
      if (evaluateAtRef.current && Date.now() >= evaluateAtRef.current) {
        evaluateAtRef.current = 0;
        await runEvaluation();
      }

      const frame = captureFrame();
      if (!frame) {
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }
      setAnalyzing(true);
      try {
        const res = await analyze({
          data: {
            image: frame,
            timeframe: "1min",
            lessons: lessonsRef.current.join("\n") || undefined,
            stats: statsRef.current,
          },
        });
        setAnalyzing(false);
        setError(null);
        backoffMs = 0;

        const signal: SignalKind =
          res.signal !== "WAIT" && res.confidence < MIN_CONFIDENCE ? "WAIT" : res.signal;

        const row: SignalRow = {
          id: crypto.randomUUID(),
          ts: Date.now(),
          signal,
          confidence: res.confidence,
          reason:
            signal === "WAIT" && res.signal !== "WAIT"
              ? `Confiança baixa (${res.confidence}%) — aguardando setup mais claro`
              : res.reason,
          latencyMs: res.latencyMs,
          outcome: null,
        };
        setCurrent(row);
        setHistory((h) => [row, ...h].slice(0, 30));

        if (signal !== "WAIT" && res.confidence >= MIN_CONFIDENCE) {
          if (signal === "CALL") alertCall();
          else alertPut();
          pendingTradeRef.current = row;
          lockUntilRef.current = Date.now() + CYCLE_LOCK_MS;
          evaluateAtRef.current = lockUntilRef.current;
          setLockRemaining(Math.ceil(CYCLE_LOCK_MS / 1000));
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
  }, [analyze, alertCall, alertPut, captureFrame, lockRemaining, runEvaluation]);

  const toggleRun = useCallback(() => {
    if (running) {
      runningRef.current = false;
      setRunning(false);
      return;
    }
    if (!sharing) return;
    runningRef.current = true;
    setRunning(true);
    lockUntilRef.current = 0;
    setLockRemaining(0);
    void loop();
  }, [running, sharing, loop]);

  const resetLearning = useCallback(() => {
    lessonsRef.current = [];
    statsRef.current = { wins: 0, losses: 0 };
    saveLessons([]);
    saveStats({ wins: 0, losses: 0 });
    setStats({ wins: 0, losses: 0 });
  }, []);

  useEffect(() => () => stopSharing(), [stopSharing]);

  const total = stats.wins + stats.losses;
  const winRate = total > 0 ? Math.round((stats.wins / total) * 100) : 0;

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
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-3 rounded-lg bg-white/[0.04] border border-white/10 px-3 py-1.5">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-white/40">Win</div>
              <div className="text-sm font-bold text-emerald-400 tabular-nums">{stats.wins}</div>
            </div>
            <div className="h-6 w-px bg-white/10" />
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-white/40">Loss</div>
              <div className="text-sm font-bold text-red-400 tabular-nums">{stats.losses}</div>
            </div>
            <div className="h-6 w-px bg-white/10" />
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-white/40">Taxa</div>
              <div className="text-sm font-bold tabular-nums">{winRate}%</div>
            </div>
          </div>
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

          <div className="flex gap-2 flex-wrap">
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
            <Button
              onClick={resetLearning}
              variant="outline"
              size="lg"
              className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
            >
              Zerar aprendizado
            </Button>
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
        </section>

        <aside className="col-span-12 lg:col-span-4 space-y-4">
          <CurrentSignal row={current} analyzing={analyzing} lockRemaining={lockRemaining} />
          <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3">
              Histórico
            </h3>
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {history.length === 0 && <p className="text-sm text-white/40">Sem sinais ainda.</p>}
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
          className={
            isCall ? "h-full bg-emerald-400" : isPut ? "h-full bg-red-400" : "h-full bg-white/30"
          }
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
      {row.outcome && row.outcome !== null && (
        <OutcomeBadge outcome={row.outcome} lesson={row.lesson} />
      )}
    </div>
  );
}

function OutcomeBadge({ outcome, lesson }: { outcome: Outcome; lesson?: string }) {
  if (!outcome) return null;
  const map = {
    WIN: {
      cls: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
      Icon: Check,
      label: "WIN",
    },
    LOSS: { cls: "bg-red-500/15 border-red-500/40 text-red-300", Icon: X, label: "LOSS" },
    UNKNOWN: {
      cls: "bg-white/5 border-white/20 text-white/60",
      Icon: HelpCircle,
      label: "Indefinido",
    },
  } as const;
  const cfg = map[outcome];
  const Icon = cfg.Icon;
  return (
    <div className={`mt-3 rounded-lg border px-3 py-2 ${cfg.cls}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" strokeWidth={3} />
        <span className="text-sm font-bold">Resultado: {cfg.label}</span>
      </div>
      {lesson && <p className="text-xs mt-1 opacity-80">Lição: {lesson}</p>}
    </div>
  );
}

function HistoryRow({ row }: { row: SignalRow }) {
  const isCall = row.signal === "CALL";
  const isPut = row.signal === "PUT";
  const color = isCall ? "text-emerald-400" : isPut ? "text-red-400" : "text-white/50";
  const Icon = isCall ? TrendingUp : isPut ? TrendingDown : Minus;
  const time = new Date(row.ts).toLocaleTimeString("pt-BR", { hour12: false });

  const outcomeDot =
    row.outcome === "WIN"
      ? "bg-emerald-400"
      : row.outcome === "LOSS"
        ? "bg-red-400"
        : row.outcome === "UNKNOWN"
          ? "bg-white/40"
          : null;

  return (
    <div className="flex items-center gap-3 rounded-lg bg-white/[0.02] border border-white/5 px-3 py-2">
      <Icon className={`h-4 w-4 ${color}`} strokeWidth={2.5} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${color}`}>{row.signal}</span>
          <span className="text-xs text-white/40">{row.confidence}%</span>
          {outcomeDot && <span className={`h-2 w-2 rounded-full ${outcomeDot}`} />}
        </div>
        <p className="text-xs text-white/50 truncate">{row.lesson || row.reason}</p>
      </div>
      <span className="text-[10px] text-white/30 tabular-nums">{time}</span>
    </div>
  );
}
