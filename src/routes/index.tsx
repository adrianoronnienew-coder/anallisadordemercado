import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Check, Play, Star, ArrowRight, Instagram, Youtube, Linkedin } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-orange-500 selection:text-white">
      {/* Header / Navbar */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-black/80 backdrop-blur-md">
        <div className="container mx-auto flex h-20 items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 bg-orange-600 rounded-lg flex items-center justify-center font-bold text-xl italic">V</div>
            <span className="text-xl font-bold tracking-tighter uppercase">Voss Academy</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#metodo" className="hover:text-white transition-colors">O Método</a>
            <a href="#resultados" className="hover:text-white transition-colors">Resultados</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
          <Button className="bg-orange-600 hover:bg-orange-700 text-white border-none font-bold px-6">
            MATRICULAR AGORA
          </Button>
        </div>
      </nav>

      <main className="pt-20">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 lg:py-32">
          <div className="container mx-auto px-4 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-xs font-semibold text-orange-500 mb-8 uppercase tracking-wider">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500"></span>
              </span>
              Inscrições Abertas - Turma 2024
            </div>
            
            <h1 className="mx-auto max-w-4xl text-5xl font-black tracking-tight sm:text-7xl lg:text-8xl mb-6">
              DOMINE A IA E CRIE <span className="text-orange-600 italic">QUALQUER</span> SITE OU APP
            </h1>
            
            <p className="mx-auto max-w-2xl text-lg text-zinc-400 mb-10 sm:text-xl">
              Aprenda a criar sites, apps, e-commerces e qualquer aplicação usando IA e ferramentas no-code. Sem programar uma única linha de código.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Button size="lg" className="h-14 px-8 bg-orange-600 hover:bg-orange-700 text-lg font-bold w-full sm:w-auto">
                QUERO MEU ACESSO AGORA <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-8 border-white/20 hover:bg-white/5 text-lg font-bold w-full sm:w-auto">
                <Play className="mr-2 h-5 w-5 fill-current" /> VER VÍDEO
              </Button>
            </div>

            {/* Social Proof / Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto py-12 border-y border-white/5">
              {[
                { label: "Alunos Ativos", value: "5.000+" },
                { label: "Aulas Gravadas", value: "350+" },
                { label: "Projetos Prontos", value: "20+" },
                { label: "Nota dos Alunos", value: "4.9/5" },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-white mb-1">{stat.value}</div>
                  <div className="text-xs sm:text-sm text-zinc-500 font-medium uppercase tracking-widest">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Background decoration */}
          <div className="absolute top-0 left-1/2 -z-10 h-[1000px] w-[1000px] -translate-x-1/2 rounded-full bg-orange-600/10 blur-[120px]"></div>
        </section>

        {/* Video / Preview Section */}
        <section className="py-20 bg-zinc-950/50" id="metodo">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto aspect-video rounded-3xl border border-white/10 bg-zinc-900 overflow-hidden relative group cursor-pointer shadow-2xl shadow-orange-950/20">
              <img 
                src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=2072" 
                alt="Voss Academy Preview" 
                className="w-full h-full object-cover opacity-50 transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-20 w-20 bg-orange-600 rounded-full flex items-center justify-center pl-1 shadow-xl group-hover:scale-110 transition-transform">
                  <Play className="h-8 w-8 text-white fill-current" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features / Benefits */}
        <section className="py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-5xl font-bold mb-6 italic uppercase tracking-tighter">O QUE VOCÊ VAI RECEBER</h2>
              <p className="text-zinc-500 max-w-2xl mx-auto">Tudo o que você precisa para sair do zero e se tornar um Desenvolvedor IA completo em 14 dias.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  title: "Domínio da IA",
                  description: "Aprenda a usar ChatGPT, Claude e Midjourney para acelerar sua produtividade em 10x.",
                  icon: <Star className="text-orange-600 h-8 w-8" />
                },
                {
                  title: "Sites de Alta Performance",
                  description: "Crie interfaces modernas e responsivas que vendem sem precisar escrever código.",
                  icon: <Play className="text-orange-600 h-8 w-8" />
                },
                {
                  title: "Sistemas Completos",
                  description: "Construa Dashboards, SaaS e E-commerces integrados com pagamentos e banco de dados.",
                  icon: <Check className="text-orange-600 h-8 w-8" />
                }
              ].map((feature, i) => (
                <div key={i} className="p-8 rounded-2xl border border-white/5 bg-zinc-900/50 hover:border-orange-500/30 transition-all group">
                  <div className="mb-6">{feature.icon}</div>
                  <h3 className="text-xl font-bold mb-4">{feature.title}</h3>
                  <p className="text-zinc-400 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-24 bg-zinc-950/50" id="faq">
          <div className="container mx-auto px-4 max-w-3xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-5xl font-bold italic uppercase">PERGUNTAS FREQUENTES</h2>
            </div>
            
            <Accordion type="single" collapsible className="w-full">
              {[
                { q: "Preciso saber programar?", a: "Não! Nosso método é focado em ferramentas no-code e inteligência artificial. Você vai criar aplicações complexas sem digitar código." },
                { q: "Quanto tempo dura o curso?", a: "O curso é vitalício. O método é desenhado para você ter seus primeiros resultados reais em até 14 dias." },
                { q: "Tenho suporte?", a: "Sim! Temos uma comunidade exclusiva de alunos e suporte técnico direto para tirar todas as suas dúvidas." },
                { q: "Quais ferramentas vou aprender?", a: "Aprenderemos Lovable, Supabase, Bubble, Webflow e as principais IAs do mercado como ChatGPT e Claude." }
              ].map((item, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border-white/10">
                  <AccordionTrigger className="text-lg font-bold hover:text-orange-500 py-6">{item.q}</AccordionTrigger>
                  <AccordionContent className="text-zinc-400 text-base leading-relaxed pb-6">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 relative overflow-hidden">
          <div className="container mx-auto px-4 text-center relative z-10">
            <div className="max-w-4xl mx-auto p-12 sm:p-20 rounded-[40px] border border-orange-500/20 bg-gradient-to-b from-orange-500/10 to-transparent">
              <h2 className="text-4xl sm:text-6xl font-black mb-8 italic uppercase tracking-tighter">SUA JORNADA COMEÇA AGORA</h2>
              <p className="text-xl text-zinc-400 mb-12 max-w-2xl mx-auto">Não perca a chance de entrar na nova economia da tecnologia com o poder da Inteligência Artificial.</p>
              <Button size="lg" className="h-16 px-12 bg-orange-600 hover:bg-orange-700 text-xl font-black w-full sm:w-auto shadow-2xl shadow-orange-600/20">
                GARANTIR MINHA VAGA <ArrowRight className="ml-2" />
              </Button>
            </div>
          </div>
          <div className="absolute bottom-0 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-orange-600/20 blur-[150px]"></div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-20 bg-black">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-12 mb-16">
            <div className="flex flex-col items-center md:items-start gap-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 bg-orange-600 rounded flex items-center justify-center font-bold italic">V</div>
                <span className="text-xl font-bold uppercase tracking-tighter">Voss Academy</span>
              </div>
              <p className="text-zinc-500 text-sm max-w-xs text-center md:text-left">Transformando curiosos em desenvolvedores de elite através da IA.</p>
            </div>
            
            <div className="flex gap-6">
              <a href="#" className="h-12 w-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="h-12 w-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors">
                <Youtube className="h-5 w-5" />
              </a>
              <a href="#" className="h-12 w-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 transition-colors">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>
          
          <div className="text-center pt-8 border-t border-white/5 text-zinc-600 text-xs uppercase tracking-widest font-medium">
            © 2024 Voss Academy. Todos os direitos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}
