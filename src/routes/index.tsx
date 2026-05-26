import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Check, Play, Star, ArrowRight, Instagram, Youtube, Linkedin, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [timeLeft, setTimeLeft] = useState({
    days: 2,
    hours: 2,
    minutes: 16,
    seconds: 40
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        if (prev.days > 0) return { ...prev, days: prev.days - 1, hours: 23, minutes: 59, seconds: 59 };
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatNumber = (num: number) => num.toString().padStart(2, '0');

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white selection:bg-[#90FF90] selection:text-black font-sans">
      {/* Top Banner / Countdown */}
      <div className="bg-[#1A1A1A] py-3 px-4 border-b border-white/5">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-center gap-4 text-center">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-tight">
            <span className="text-orange-500 animate-pulse">🔥</span>
            <span>Últimas vagas com acesso completo à Voss Academy</span>
          </div>
          <div className="hidden md:block h-4 w-px bg-white/20"></div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5 items-center">
              <span className="text-xl font-black text-orange-500">{formatNumber(timeLeft.days)}</span>
              <span className="text-[10px] font-bold text-zinc-500 uppercase">Dias</span>
            </div>
            <span className="text-zinc-700 font-bold">:</span>
            <div className="flex gap-1.5 items-center">
              <span className="text-xl font-black text-orange-500">{formatNumber(timeLeft.hours)}</span>
              <span className="text-[10px] font-bold text-zinc-500 uppercase">Horas</span>
            </div>
            <span className="text-zinc-700 font-bold">:</span>
            <div className="flex gap-1.5 items-center">
              <span className="text-xl font-black text-orange-500">{formatNumber(timeLeft.minutes)}</span>
              <span className="text-[10px] font-bold text-zinc-500 uppercase">Min</span>
            </div>
            <span className="text-zinc-700 font-bold">:</span>
            <div className="flex gap-1.5 items-center">
              <span className="text-xl font-black text-orange-500">{formatNumber(timeLeft.seconds)}</span>
              <span className="text-[10px] font-bold text-zinc-500 uppercase">Seg</span>
            </div>
          </div>
          <button className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-black px-4 py-1.5 rounded uppercase tracking-tighter transition-all">
            Garantir Oferta
          </button>
        </div>
      </div>

      {/* Header / Navbar */}
      <nav className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#0A0A0A]/90 backdrop-blur-xl">
        <div className="container mx-auto flex h-20 items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-2 cursor-pointer group">
            <div className="h-9 w-9 bg-orange-600 rounded flex items-center justify-center font-black text-xl italic group-hover:scale-105 transition-transform">V</div>
            <span className="text-lg font-black tracking-tighter uppercase leading-none">Voss Academy</span>
          </div>
          
          <div className="hidden lg:flex items-center gap-10 text-xs font-bold uppercase tracking-widest text-zinc-400">
            <a href="#" className="hover:text-white transition-colors">Cursos Completos</a>
            <a href="#" className="hover:text-white transition-colors">Cursos Gratuitos</a>
            <a href="#" className="hover:text-white transition-colors">Para Empresas</a>
          </div>

          <div className="flex items-center gap-4">
            <a href="#" className="hidden sm:block text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors">Entrar</a>
            <Button className="bg-[#90FF90] hover:bg-[#70FF70] text-black border-none font-black text-xs px-6 py-6 rounded-none uppercase tracking-widest">
              Começar Agora
            </Button>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative pt-24 pb-20 lg:pt-32 lg:pb-32 overflow-hidden">
          <div className="container mx-auto px-4 text-center relative z-10">
            <div className="inline-flex items-center gap-3 rounded-full border border-orange-500/20 bg-orange-500/5 px-5 py-2 text-[10px] font-black text-orange-500 mb-12 uppercase tracking-[0.2em]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-500 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500"></span>
              </span>
              Melhor curso de Lovable do mundo
            </div>
            
            <h1 className="mx-auto max-w-5xl text-5xl font-black tracking-tighter sm:text-7xl lg:text-9xl mb-8 leading-[0.9]">
              CRIE SITES E <br />
              APLICATIVOS COM IA, <br />
              <span className="text-[#90FF90] italic">SEM PROGRAMAR!</span>
            </h1>
            
            <p className="mx-auto max-w-2xl text-lg text-zinc-500 mb-12 font-medium leading-relaxed">
              Transforme ideias em negócios lucrativos usando ferramentas de IA, mesmo sem saber nada de programação.
            </p>

            {/* Video Preview Card */}
            <div className="max-w-4xl mx-auto relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 to-[#90FF90] rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative aspect-video rounded-2xl border border-white/10 bg-zinc-900 overflow-hidden shadow-2xl">
                <img 
                  src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=2070" 
                  className="w-full h-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-105"
                  alt="Rafa Voss"
                />
                
                {/* Video Info Header */}
                <div className="absolute top-0 left-0 w-full p-4 flex items-center gap-3 bg-gradient-to-b from-black/80 to-transparent">
                  <div className="h-10 w-10 rounded-full border-2 border-[#90FF90] overflow-hidden">
                    <img src="https://github.com/shadcn.png" alt="Rafa Voss" className="w-full h-full object-cover" />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold leading-none">Intro Curso - LovablePRO</div>
                    <div className="text-[10px] text-zinc-400 font-medium">Rafa Voss | Claude & AI</div>
                  </div>
                </div>

                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-600 blur-2xl opacity-50 animate-pulse"></div>
                    <div className="relative h-16 w-24 bg-red-600 rounded-xl flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
                      <Play className="h-8 w-8 text-white fill-current" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Background Gradients */}
          <div className="absolute top-0 left-1/4 -z-10 h-[600px] w-[600px] rounded-full bg-orange-600/10 blur-[120px]"></div>
          <div className="absolute bottom-0 right-1/4 -z-10 h-[600px] w-[600px] rounded-full bg-[#90FF90]/5 blur-[120px]"></div>
        </section>

        {/* Floating WhatsApp */}
        <div className="fixed bottom-8 right-8 z-[100] cursor-pointer group">
          <div className="absolute inset-0 bg-green-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
          <div className="relative h-16 w-16 bg-[#25D366] rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <MessageCircle className="h-8 w-8 text-white fill-current" />
          </div>
        </div>
      </main>
    </div>
  );
}
