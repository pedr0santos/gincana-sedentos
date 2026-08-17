import { Download, Share2, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isAppleMobile() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function InstallAppPrompt() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [showIosSteps, setShowIosSteps] = useState(false);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem("sedentos-install-dismissed") === "true");
  const [installed, setInstalled] = useState(() => isStandalone());

  useEffect(() => {
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", capturePrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturePrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || dismissed || (!promptEvent && !isAppleMobile())) return null;

  const dismiss = () => {
    sessionStorage.setItem("sedentos-install-dismissed", "true");
    setDismissed(true);
  };

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPromptEvent(null);
  };

  return (
    <aside className="fixed inset-x-4 bottom-5 z-50 mx-auto max-w-md rounded-2xl border border-teal-200/25 bg-[#0b2729]/95 p-4 text-white shadow-[0_20px_55px_rgba(0,0,0,.45)] backdrop-blur-xl" role="region" aria-label="Instalar aplicativo">
      <div className="flex gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-200 text-[#06282a]"><Smartphone size={21} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold">Leve a Gincana para a tela inicial</p>
          <p className="mt-1 text-xs leading-5 text-slate-300">Abra como aplicativo, sem procurar o link a cada rodada.</p>
        </div>
        <button className="-mr-1 -mt-1 rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white" onClick={dismiss} aria-label="Fechar aviso de instalação"><X size={17} /></button>
      </div>
      {showIosSteps ? <div className="mt-3 rounded-xl bg-white/8 p-3 text-xs leading-5 text-slate-200"><p className="font-bold text-teal-100">No iPhone ou iPad</p><p className="mt-1">Toque em <Share2 className="mx-0.5 inline" size={14} /> <strong>Compartilhar</strong> no Safari e escolha <strong>Adicionar à Tela de Início</strong>.</p></div> : <button className="mt-3 inline-flex items-center gap-2 rounded-xl bg-teal-200 px-3.5 py-2.5 text-xs font-extrabold text-[#06282a] transition active:scale-[.97]" onClick={promptEvent ? install : () => setShowIosSteps(true)}><Download size={15} /> Instalar aplicativo</button>}
    </aside>
  );
}
