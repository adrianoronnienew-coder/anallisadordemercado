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
  Activity,
  CandlestickChart,
  Gauge,
  Waves,
  Target,
  TriangleAlert,
  Clock3,
  Crosshair,
  Download,
  RotateCcw,
  Search,
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
      { property: "og:title", content: "Signal Vision — Análise de tela em tempo real" },
      {
        property: "og:description",
        content: "Leitura técnica visual e sinais CALL/PUT a partir do gráfico compartilhado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type SignalKind = "CALL" | "PUT" | "WAIT";
type Outcome = "WIN" | "LOSS" | "UNKNOWN" | null;
type TechnicalReading = {
  trend: string;
  ema: string;
  ema50: string;
  momentum: string;
  rsi: string;
  volatility: string;
  bollinger: string;
  atr: string;
  adx: string;
  candlePattern: string;
  supportResistance: string;
  macd: string;
  stochastic: string;
  fibonacci: string;
  volume: string;
  score: number;
  bias: "CALL" | "PUT" | "NEUTRAL";
  confluences: string[];
  warnings: string[];
  checksPassed: string[];
  checksPending: string[];
  nextCondition: string;
  overlay: {
    supportY: number | null;
    resistanceY: number | null;
    trendStart: { x: number; y: number } | null;
    trendEnd: { x: number; y: number } | null;
    entry: { x: number; y: number } | null;
  };
};
type SignalRow = {
  id: string;
  ts: number;
  signal: SignalKind;
  confidence: number;
  reason: string;
  latencyMs: number;
  outcome?: Outcome;
  lesson?: string;
  candidateSignal?: "CALL" | "PUT";
  analysis?: TechnicalReading;
  expirationMinutes: number;
};

const LESSONS_KEY = "sv_lessons_v1";
const STATS_KEY = "sv_stats_v1";
const BACKTEST_KEY = "sv_backtest_v1";
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
  const lastCandidateRef = useRef<{
    signal: "CALL" | "PUT";
    ts: number;
    remainingChecks: number;
  } | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const stableOverlayRef = useRef<TechnicalReading["overlay"] | null>(null);
  const overlayLockedUntilRef = useRef(0);
  const zoomRef = useRef(1);
  const focusXRef = useRef(50);
  const focusYRef = useRef(50);

  const [sharing, setSharing] = useState(false);
  const [running, setRunning] = useState(false);
  const [sound, setSound] = useState(true);
  const [current, setCurrent] = useState<SignalRow | null>(null);
  const [history, setHistory] = useState<SignalRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [lockRemaining, setLockRemaining] = useState(0);
  const [stats, setStats] = useState<{ wins: number; losses: number }>({ wins: 0, losses: 0 });
  const [soundReady, setSoundReady] = useState(false);
  const [expirationMinutes, setExpirationMinutes] = useState(1);
  const expirationRef = useRef(1);
  const [analysisStage, setAnalysisStage] = useState("Parado");
  const [lastAnalysisAt, setLastAnalysisAt] = useState<number | null>(null);
  const [nextAnalysisIn, setNextAnalysisIn] = useState(0);
  const [overlayLockedUntil, setOverlayLockedUntil] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [focusX, setFocusX] = useState(50);
  const [focusY, setFocusY] = useState(50);

  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  useEffect(() => {
    lessonsRef.current = loadLessons();
    const s = loadStats();
    statsRef.current = s;
    setStats(s);
    try {
      const saved = JSON.parse(localStorage.getItem(BACKTEST_KEY) || "[]") as SignalRow[];
      setHistory(saved);
    } catch {}
  }, []);

  // Live countdown ticker for lock (independent of loop)
  useEffect(() => {
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockUntilRef.current - Date.now()) / 1000));
      setLockRemaining((prev) => (prev !== remaining ? remaining : prev));
      setNextAnalysisIn((prev) => (runningRef.current && prev > 0 ? Math.max(0, prev - 0.25) : prev));
    }, 250);
    return () => clearInterval(id);
  }, []);

  // ==== Efeitos sonoros ====
  const unlockSound = useCallback(() => {
    if (!soundRef.current) return false;
    try {
      const AudioContextCtor = window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return false;
      const ctx = audioContextRef.current ?? new AudioContextCtor();
      audioContextRef.current = ctx;
      if (ctx.state === "suspended") void ctx.resume();

      // A fonte silenciosa, criada dentro do clique, desbloqueia áudio no Chrome/Safari.
      const source = ctx.createBufferSource();
      source.buffer = ctx.createBuffer(1, 1, 22050);
      source.connect(ctx.destination);
      source.start(0);
      setSoundReady(true);
      return true;
    } catch {
      setSoundReady(false);
      return false;
    }
  }, []);

  const playTone = useCallback(
    (steps: { freq: number; dur: number; delay: number; type?: OscillatorType; gain?: number }[]) => {
      if (!soundRef.current) return;
      try {
        const ctx = audioContextRef.current;
        if (!ctx) {
          setSoundReady(false);
          return;
        }
        if (ctx.state === "suspended") void ctx.resume();
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
      } catch {
        setSoundReady(false);
      }
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
  const alertCandidate = useCallback(
    () =>
      playTone([
        { freq: 620, dur: 0.14, delay: 0, type: "triangle", gain: 0.28 },
        { freq: 760, dur: 0.18, delay: 0.17, type: "triangle", gain: 0.28 },
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

  const testSound = useCallback(() => {
    const ready = unlockSound();
    if (!ready) {
      setError("O navegador bloqueou o áudio. Toque novamente em Testar som.");
      return;
    }
    setError(null);
    playTone([
      { freq: 740, dur: 0.12, delay: 0, type: "triangle", gain: 0.3 },
      { freq: 988, dur: 0.2, delay: 0.14, type: "triangle", gain: 0.3 },
    ]);
  }, [playTone, unlockSound]);

  const stopSharing = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setSharing(false);
    setAnalysisStage("Tela desconectada");
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
      unlockSound();
    } catch (e: any) {
      setError(e?.message ?? "Falha ao compartilhar tela");
    }
  }, [stopSharing, unlockSound]);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return null;
    const sourceScale = zoomRef.current;
    const sourceW = video.videoWidth / sourceScale;
    const sourceH = video.videoHeight / sourceScale;
    const maxX = video.videoWidth - sourceW;
    const maxY = video.videoHeight - sourceH;
    const sourceX = maxX * (focusXRef.current / 100);
    const sourceY = maxY * (focusYRef.current / 100);
    const targetW = Math.min(900, sourceW);
    const scale = targetW / video.videoWidth;
    canvas.width = targetW;
    canvas.height = Math.round(sourceH * (targetW / sourceW));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, sourceX, sourceY, sourceW, sourceH, 0, 0, canvas.width, canvas.height);
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
          expirationMinutes: pending.expirationMinutes,
        },
      });
      // Atualiza histórico e sinal atual
      setHistory((h) =>
        h.map((r) => {
          const next = r.id === pending.id ? { ...r, outcome: res.outcome, lesson: res.lesson } : r;
          return next;
        }),
      );
      setHistory((h) => {
        try { localStorage.setItem(BACKTEST_KEY, JSON.stringify(h)); } catch {}
        return h;
      });
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
    const MIN_CONFIDENCE = 70;
    const CANDIDATE_TTL_MS = 45000;
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
      setAnalysisStage("Imagem capturada · enviando para análise");
      try {
        const res = await analyze({
          data: {
            image: frame,
            timeframe: "1min",
            expirationMinutes: expirationRef.current,
            lessons: lessonsRef.current.join("\n") || undefined,
            stats: statsRef.current,
          },
        });
        setAnalyzing(false);
        setAnalysisStage("Leitura concluída");
        setLastAnalysisAt(Date.now());
        setNextAnalysisIn(MIN_INTERVAL_MS / 1000);
        setError(null);
        backoffMs = 0;

        const rawSignal: SignalKind =
          res.signal !== "WAIT" && res.confidence < MIN_CONFIDENCE ? "WAIT" : res.signal;

        // Confirmação em duas leituras compatível com a latência real da IA.
        let signal: SignalKind = "WAIT";
        let confirmedReason = res.reason;
        let candidateSignal: "CALL" | "PUT" | undefined;
        if (rawSignal === "CALL" || rawSignal === "PUT") {
          const last = lastCandidateRef.current;
          const fresh = last && Date.now() - last.ts < CANDIDATE_TTL_MS;
          if (fresh && last.signal === rawSignal) {
            signal = rawSignal;
            lastCandidateRef.current = null;
            confirmedReason = `${rawSignal === "CALL" ? "COMPRE AGORA" : "VENDA AGORA"} — ${res.reason.replace(/^(COMPRE|VENDA) AGORA\s*[—-]?\s*/i, "")}`;
          } else {
            lastCandidateRef.current = { signal: rawSignal, ts: Date.now(), remainingChecks: 3 };
            candidateSignal = rawSignal;
            alertCandidate();
            confirmedReason = `Candidato ${rawSignal} (${res.confidence}%) — aguardando confirmação`;
          }
        } else {
          const last = lastCandidateRef.current;
          if (last && Date.now() - last.ts < CANDIDATE_TTL_MS && last.remainingChecks > 1) {
            lastCandidateRef.current = { ...last, remainingChecks: last.remainingChecks - 1 };
            candidateSignal = last.signal;
            confirmedReason = `Candidato ${last.signal} mantido — aguardando nova confirmação`;
          } else {
            lastCandidateRef.current = null;
          }
        }

        const receivedOverlay = res.analysis.overlay;
        const hasStructuralOverlay =
          receivedOverlay.supportY !== null ||
          receivedOverlay.resistanceY !== null ||
          (receivedOverlay.trendStart !== null && receivedOverlay.trendEnd !== null);
        if ((!stableOverlayRef.current || Date.now() >= overlayLockedUntilRef.current) && hasStructuralOverlay) {
          stableOverlayRef.current = { ...receivedOverlay, entry: null };
          overlayLockedUntilRef.current = Date.now() + Math.max(60000, expirationRef.current * 60000);
          setOverlayLockedUntil(overlayLockedUntilRef.current);
        }
        const stableOverlay = stableOverlayRef.current
          ? { ...stableOverlayRef.current, entry: receivedOverlay.entry }
          : receivedOverlay;

        const row: SignalRow = {
          id: crypto.randomUUID(),
          ts: Date.now(),
          signal,
          confidence: res.confidence,
          reason:
            signal === "WAIT" && rawSignal !== "WAIT"
              ? confirmedReason
              : signal === "WAIT" && res.signal !== "WAIT"
                ? `Confiança baixa (${res.confidence}%) — aguardando setup mais claro`
                : res.reason,
          latencyMs: res.latencyMs,
          outcome: null,
          candidateSignal,
          analysis: { ...res.analysis, overlay: stableOverlay },
          expirationMinutes: expirationRef.current,
        };
        setCurrent(row);
        setHistory((h) => [row, ...h].slice(0, 30));

        if (signal !== "WAIT") {
          if (signal === "CALL") alertCall();
          else alertPut();
          pendingTradeRef.current = row;
          const cycleLockMs = expirationRef.current * 60000;
          lockUntilRef.current = Date.now() + cycleLockMs;
          evaluateAtRef.current = lockUntilRef.current;
          setLockRemaining(Math.ceil(cycleLockMs / 1000));
        }
      } catch (e: any) {
        setAnalyzing(false);
        const msg = String(e?.message ?? "");
        const is429 = /429|too many|rate/i.test(msg);
        if (is429) {
          backoffMs = Math.min(backoffMs ? backoffMs * 2 : 4000, 30000);
          setError(`Rate limit atingido — aguardando ${Math.round(backoffMs / 1000)}s…`);
          setAnalysisStage("Pausado pelo limite do serviço");
        } else {
          backoffMs = 1500;
          setError(msg || "Erro na análise");
          setAnalysisStage("Falha na análise");
        }
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
      const elapsed = Date.now() - cycleStart;
      if (elapsed < MIN_INTERVAL_MS) {
        await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - elapsed));
      }
    }
  }, [analyze, alertCall, alertCandidate, alertPut, captureFrame, lockRemaining, runEvaluation]);

  const toggleRun = useCallback(() => {
    if (running) {
      runningRef.current = false;
      setRunning(false);
      setAnalysisStage("Análise pausada");
      return;
    }
    if (!sharing) return;
    if (soundRef.current) unlockSound();
    runningRef.current = true;
    setRunning(true);
    setAnalysisStage("Preparando primeira captura");
    lockUntilRef.current = 0;
    stableOverlayRef.current = null;
    overlayLockedUntilRef.current = 0;
    setOverlayLockedUntil(0);
    setLockRemaining(0);
    void loop();
  }, [running, sharing, loop, unlockSound]);

  const resetLearning = useCallback(() => {
    lessonsRef.current = [];
    statsRef.current = { wins: 0, losses: 0 };
    saveLessons([]);
    saveStats({ wins: 0, losses: 0 });
    setStats({ wins: 0, losses: 0 });
  }, []);

  const refreshStructure = useCallback(() => {
    stableOverlayRef.current = null;
    overlayLockedUntilRef.current = 0;
    setOverlayLockedUntil(0);
    setAnalysisStage("Estrutura liberada para nova leitura");
  }, []);

  const updateZoom = useCallback((value: number) => {
    zoomRef.current = value;
    setZoom(value);
  }, []);

  const updateFocusX = useCallback((value: number) => {
    focusXRef.current = value;
    setFocusX(value);
  }, []);

  const updateFocusY = useCallback((value: number) => {
    focusYRef.current = value;
    setFocusY(value);
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
            onClick={() => {
              setSound((s) => {
                soundRef.current = !s;
                if (s) setSoundReady(false);
                return !s;
              });
            }}
            className="text-white/70 hover:text-white hover:bg-white/5"
            aria-label={sound ? "Desativar som" : "Ativar som"}
          >
            {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
          {sound && (
            <Button
              variant="outline"
              size="sm"
              onClick={testSound}
              className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              <Volume2 className="mr-2 h-4 w-4" />
              {soundReady ? "Som pronto" : "Testar som"}
            </Button>
          )}
        </div>
      </header>

      <main className="grid grid-cols-12 gap-4 p-4">
        <section className="col-span-12 lg:col-span-8 space-y-4">
          <div className="relative rounded-xl overflow-hidden bg-black border border-white/10 aspect-video">
            <video
              ref={videoRef}
              className="h-full w-full object-contain transition-transform duration-200"
              style={{ transform: `scale(${zoom})`, transformOrigin: `${focusX}% ${focusY}%` }}
              muted
              playsInline
            />
            {sharing && current?.analysis && (
              <ChartOverlay
                reading={current.analysis}
                signal={current.candidateSignal ?? current.signal}
                candidate={Boolean(current.candidateSignal)}
                lockedUntil={overlayLockedUntil}
              />
            )}
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
            {sharing && (
              <>
                {/* Scanning sweep overlay */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  {running && !current?.analysis && (
                    <div className="absolute inset-x-0 h-24 -top-24 bg-gradient-to-b from-transparent via-emerald-400/20 to-transparent animate-scan" />
                  )}
                  {/* Corner brackets */}
                  <div className="absolute top-2 left-2 h-6 w-6 border-t-2 border-l-2 border-emerald-400/60" />
                  <div className="absolute top-2 right-2 h-6 w-6 border-t-2 border-r-2 border-emerald-400/60" />
                  <div className="absolute bottom-2 left-2 h-6 w-6 border-b-2 border-l-2 border-emerald-400/60" />
                  <div className="absolute bottom-2 right-2 h-6 w-6 border-b-2 border-r-2 border-emerald-400/60" />
                </div>
              </>
            )}
            {analyzing && sharing && (
              <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/70 backdrop-blur rounded-full px-3 py-1.5 text-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Analisando…
              </div>
            )}
          </div>

          {sharing && (
            <div className="grid gap-3 border border-white/10 bg-white/[0.03] p-3 sm:grid-cols-[1fr_auto]">
              <div className="flex min-w-0 items-center gap-3">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${analyzing ? "bg-amber-300 animate-pulse" : running ? "bg-emerald-400" : "bg-white/30"}`} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{analysisStage}</p>
                  <p className="text-xs text-white/45">
                    {lastAnalysisAt ? `Última leitura ${new Date(lastAnalysisAt).toLocaleTimeString("pt-BR", { hour12: false })}` : "Nenhuma leitura recebida"}
                    {running && !analyzing && nextAnalysisIn > 0 ? ` · próxima em ${Math.ceil(nextAnalysisIn)}s` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-cyan-300" />
                <span className="text-xs font-semibold uppercase text-white/50">Expiração</span>
                <div className="flex border border-white/10 bg-black/30 p-0.5">
                  {[1, 2, 3, 5].map((minutes) => (
                    <Button
                      key={minutes}
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={lockRemaining > 0}
                      onClick={() => {
                        expirationRef.current = minutes;
                        setExpirationMinutes(minutes);
                      }}
                      className={`h-7 min-w-9 px-2 text-xs ${expirationMinutes === minutes ? "bg-cyan-400 text-black hover:bg-cyan-300" : "text-white/60 hover:bg-white/10 hover:text-white"}`}
                    >
                      {minutes}m
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {sharing && (
            <div className="grid gap-3 border border-white/10 bg-white/[0.03] p-3 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-center">
              <div className="flex items-center gap-2 text-xs font-semibold text-white/60">
                <Search className="h-4 w-4 text-cyan-300" /> Foco {zoom.toFixed(1)}×
              </div>
              <label className="text-[10px] font-semibold uppercase text-white/40">
                Zoom
                <input aria-label="Zoom do gráfico" className="mt-1 block w-full accent-cyan-400" type="range" min="1" max="2.5" step="0.1" value={zoom} onChange={(event) => updateZoom(Number(event.target.value))} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] font-semibold uppercase text-white/40">Horizontal<input aria-label="Foco horizontal" className="mt-1 block w-full accent-cyan-400" type="range" min="0" max="100" value={focusX} disabled={zoom === 1} onChange={(event) => updateFocusX(Number(event.target.value))} /></label>
                <label className="text-[10px] font-semibold uppercase text-white/40">Vertical<input aria-label="Foco vertical" className="mt-1 block w-full accent-cyan-400" type="range" min="0" max="100" value={focusY} disabled={zoom === 1} onChange={(event) => updateFocusY(Number(event.target.value))} /></label>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={refreshStructure} className="border-white/10 bg-white/5 text-white hover:bg-white/10">
                <RotateCcw className="mr-2 h-4 w-4" /> Recalcular linhas
              </Button>
            </div>
          )}

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

          <TechnicalPanel reading={current?.analysis} candidate={current?.candidateSignal} />
          <BacktestPanel history={history} onClear={() => {
            setHistory([]);
            try { localStorage.removeItem(BACKTEST_KEY); } catch {}
          }} />
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
  const displaySignal = row.candidateSignal ?? row.signal;
  const isCall = displaySignal === "CALL";
  const isPut = displaySignal === "PUT";
  const active = isCall || isPut;
  const bg = isCall
    ? "from-emerald-500/20 to-emerald-500/5 border-emerald-500/40"
    : isPut
      ? "from-red-500/20 to-red-500/5 border-red-500/40"
      : "from-white/5 to-transparent border-white/10";
  const Icon = isCall ? TrendingUp : isPut ? TrendingDown : Minus;
  const color = isCall ? "text-emerald-400" : isPut ? "text-red-400" : "text-white/60";
  const glow = isCall
    ? "shadow-[0_0_40px_rgba(52,211,153,0.35)]"
    : isPut
      ? "shadow-[0_0_40px_rgba(248,113,113,0.35)]"
      : "";

  return (
    <div
      key={row.id}
      className={`relative rounded-xl bg-gradient-to-br ${bg} border p-5 ${glow} ${active ? "animate-signal-pop" : ""}`}
    >
      {active && (
        <div
          className={`pointer-events-none absolute inset-0 rounded-xl border-2 ${
            isCall ? "border-emerald-400/60" : "border-red-400/60"
          } animate-ping-slow`}
        />
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-white/50">Sinal atual</span>
        <span className="text-xs text-white/40">{row.latencyMs}ms</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Icon
          className={`h-10 w-10 ${color} ${active ? "animate-bounce-short" : ""}`}
          strokeWidth={2.5}
        />
        <div>
          {row.candidateSignal && (
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              Em observação
            </div>
          )}
          <div className={`text-4xl font-black ${color} leading-none`}>{displaySignal}</div>
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
      {lockRemaining > 0 && active && (
        <div className="mt-4 rounded-lg bg-black/40 border border-white/10 px-3 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase tracking-wider text-white/50">
              Expiração da operação · {row.expirationMinutes}m
            </span>
            <span className={`text-lg font-bold tabular-nums ${color}`}>{lockRemaining}s</span>
          </div>
          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                isCall ? "bg-emerald-400" : "bg-red-400"
              }`}
              style={{ width: `${Math.min(100, (lockRemaining / (row.expirationMinutes * 60)) * 100)}%` }}
            />
          </div>
        </div>
      )}
      {row.outcome && row.outcome !== null && (
        <OutcomeBadge outcome={row.outcome} lesson={row.lesson} />
      )}
    </div>
  );
}

function ChartOverlay({
  reading,
  signal,
  candidate,
  lockedUntil,
}: {
  reading: TechnicalReading;
  signal: SignalKind;
  candidate: boolean;
  lockedUntil: number;
}) {
  const { overlay } = reading;
  const activeSignal = signal === "CALL" || signal === "PUT";
  const entry = overlay.entry ?? (activeSignal ? { x: 84, y: 50 } : null);
  const isCall = signal === "CALL";
  const signalColor = isCall ? "text-emerald-300" : "text-red-300";

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {overlay.resistanceY !== null && (
        <div
          className="absolute left-[6%] right-[8%] border-t-2 border-red-400/80"
          style={{ top: `${overlay.resistanceY}%` }}
        >
          <span className="absolute right-0 -translate-y-full bg-red-500/90 px-2 py-1 text-[10px] font-bold uppercase text-white">
            Resistência
          </span>
        </div>
      )}
      {overlay.supportY !== null && (
        <div
          className="absolute left-[6%] right-[8%] border-t-2 border-emerald-400/80"
          style={{ top: `${overlay.supportY}%` }}
        >
          <span className="absolute left-0 bg-emerald-500/90 px-2 py-1 text-[10px] font-bold uppercase text-black">
            Suporte
          </span>
        </div>
      )}
      {overlay.trendStart && overlay.trendEnd && (
        <svg className="absolute inset-0 h-full w-full text-cyan-300 drop-shadow-lg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line
            x1={overlay.trendStart.x}
            y1={overlay.trendStart.y}
            x2={overlay.trendEnd.x}
            y2={overlay.trendEnd.y}
            stroke="currentColor"
            strokeWidth="0.45"
            strokeDasharray="1.3 0.8"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
      {entry && activeSignal && (
        <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${entry.x}%`, top: `${entry.y}%` }}>
          <div className={`relative flex flex-col items-center ${signalColor}`}>
            <span className={`absolute h-16 w-16 rounded-full border-2 ${isCall ? "border-emerald-300/70" : "border-red-300/70"} animate-ping-slow`} />
            {isCall ? (
              <TrendingUp className="h-12 w-12 animate-bounce-short drop-shadow-lg" strokeWidth={3} />
            ) : (
              <TrendingDown className="h-12 w-12 animate-bounce-short drop-shadow-lg" strokeWidth={3} />
            )}
            <span className={`mt-1 border px-2 py-1 text-xs font-black ${isCall ? "border-emerald-300 bg-emerald-500/90 text-black" : "border-red-300 bg-red-500/90 text-white"}`}>
              {candidate ? `${signal} · OBSERVAR` : `${signal} · ENTRADA AGORA`}
            </span>
          </div>
        </div>
      )}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 border border-cyan-300/30 bg-black/75 px-2.5 py-1.5 text-[10px] font-semibold uppercase text-cyan-200 backdrop-blur-sm">
        <Crosshair className="h-3.5 w-3.5" /> Zonas fixas até {new Date(lockedUntil).toLocaleTimeString("pt-BR", { hour12: false })}
      </div>
    </div>
  );
}

function TechnicalPanel({
  reading,
  candidate,
}: {
  reading?: TechnicalReading;
  candidate?: "CALL" | "PUT";
}) {
  const items = reading
    ? [
        { label: "Tendência", value: reading.trend, Icon: Activity },
        { label: "EMA 9 / 21", value: reading.ema, Icon: Waves },
        { label: "Momentum", value: reading.momentum, Icon: Gauge },
        { label: "Velas", value: reading.candlePattern, Icon: CandlestickChart },
        { label: "Suporte / resistência", value: reading.supportResistance, Icon: Target },
        { label: "Volatilidade", value: reading.volatility, Icon: Activity },
        { label: "MACD", value: reading.macd, Icon: Waves },
        { label: "Estocástico", value: reading.stochastic, Icon: Gauge },
        { label: "Fibonacci", value: reading.fibonacci, Icon: Target },
        { label: "Volume", value: reading.volume, Icon: Activity },
      ]
    : [];

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">Leitura técnica das velas</h2>
          <p className="mt-0.5 text-xs text-white/45">Atualizada a cada imagem analisada</p>
        </div>
        {reading && (
          <div className="flex items-center gap-2">
            {candidate && (
              <span className="rounded border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-xs font-semibold text-amber-300">
                Observando {candidate}
              </span>
            )}
            <span className="rounded border border-white/10 bg-black/30 px-2 py-1 text-xs font-bold">
              Score {reading.score}/10
            </span>
          </div>
        )}
      </div>

      {!reading ? (
        <p className="mt-4 text-sm text-white/40">A leitura aparecerá após a primeira análise.</p>
      ) : (
        <>
          <div className="mt-4 grid gap-px overflow-hidden rounded border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(({ label, value, Icon }) => (
              <div key={label} className="min-h-24 bg-[#0d121d] p-3">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  <Icon className="h-3.5 w-3.5 text-cyan-400" /> {label}
                </div>
                <p className="mt-2 text-sm leading-snug text-white/75">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded border border-emerald-400/20 bg-emerald-400/[0.06] p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">Confluências</div>
              <ul className="mt-2 space-y-1 text-xs text-white/70">
                {reading.confluences.length ? reading.confluences.map((item) => <li key={item}>+ {item}</li>) : <li>Nenhuma confirmação forte</li>}
              </ul>
            </div>
            <div className="rounded border border-amber-400/20 bg-amber-400/[0.06] p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                <TriangleAlert className="h-3.5 w-3.5" /> Alertas técnicos
              </div>
              <ul className="mt-2 space-y-1 text-xs text-white/70">
                {reading.warnings.length ? reading.warnings.map((item) => <li key={item}>• {item}</li>) : <li>Nenhum contra-sinal forte</li>}
              </ul>
            </div>
          </div>
        </>
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
