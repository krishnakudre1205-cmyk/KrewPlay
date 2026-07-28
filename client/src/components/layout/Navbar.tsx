import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Download, Smartphone, CheckCircle2, Share2, X, Monitor, User } from "lucide-react";
import logoImg from "../../assets/logo.png";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function Navbar() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [username, setUsername] = useState<string>("");

  useEffect(() => {
    const checkUser = () => {
      const session = localStorage.getItem("user");
      if (session) {
        try {
          const parsed = JSON.parse(session);
          setUsername(parsed.username || "Account");
        } catch {
          setUsername("Account");
        }
      } else {
        setUsername("Account");
      }
    };
    checkUser();
    window.addEventListener("storage", checkUser);
    return () => window.removeEventListener("storage", checkUser);
  }, []);

  useEffect(() => {
    // Check if running as an installed PWA app
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === "accepted") {
          setIsStandalone(true);
          setDeferredPrompt(null);
        }
      } catch (err) {
        console.error("Install prompt error:", err);
        setShowModal(true);
      }
    } else {
      // Open step-by-step instructions modal if direct prompt isn't available
      setShowModal(true);
    }
  };

  return (
    <>
      <nav className="sticky top-0 z-50 bg-[#0d0006]/85 border-b border-burgundy-900/35 backdrop-blur-md select-none">
        <div className="w-full flex items-center justify-between px-3 py-2 md:px-6">
          {/* KrewPlay Logo */}
          <Link to="/" className="group flex items-center">
            <img
              src={logoImg}
              alt="KrewPlay"
              className="h-16 w-auto object-contain transition-all duration-300 group-hover:scale-[1.03] select-none filter drop-shadow-[0_5px_10px_rgba(0,0,0,0.5)] group-hover:drop-shadow-[0_8px_20px_rgba(0,0,0,0.7)]"
            />
          </Link>

            {/* Right Action: Account & Install KrewPlay App */}
          <div className="flex items-center gap-3">
            {/* Account Link */}
            <Link
              to="/account"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-burgundy-950/80 hover:bg-burgundy-900 border border-burgundy-900/60 text-lavender-200 hover:text-white text-sm font-semibold transition-all duration-200 shadow-sm"
            >
              <User className="w-4 h-4 text-rose-400" />
              <span>{username || "Account"}</span>
            </Link>

            <div className="hidden">
            {isStandalone ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold tracking-wide shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>KrewPlay App Installed</span>
              </div>
            ) : (
              <button
                onClick={handleInstallClick}
                className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-medium text-sm shadow-[0_0_20px_rgba(244,63,94,0.35)] hover:shadow-[0_0_30px_rgba(244,63,94,0.65)] transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer overflow-hidden"
                title="Install KrewPlay as an application"
              >
                <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                <Download className="w-4 h-4 transition-transform duration-300 group-hover:-translate-y-0.5" />
                <span className="relative z-10 font-semibold tracking-wide">
                  Install App
                </span>
              </button>
            )}
            </div>
          </div>
        </div>
      </nav>

      {/* Install KrewPlay Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-[#14000a]/95 border border-burgundy-900/60 p-6 md:p-8 shadow-[0_0_50px_rgba(244,63,94,0.25)] text-lavender-50">
            {/* Close Button */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-lavender-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex flex-col items-center text-center mb-6">
              <img
                src={logoImg}
                alt="KrewPlay Logo"
                className="h-16 w-auto object-contain mb-3 filter drop-shadow-[0_4px_12px_rgba(244,63,94,0.4)]"
              />
              <h3 className="text-xl md:text-2xl font-bold tracking-tight text-white">
                Install KrewPlay App
              </h3>
              <p className="text-xs md:text-sm text-lavender-300/80 mt-1 max-w-sm">
                Enjoy KrewPlay as a standalone desktop or mobile application with synchronized cinematic playback.
              </p>
            </div>

            {/* Platform Guides */}
            <div className="space-y-4 text-left text-sm">
              {/* Desktop Instruction */}
              <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10 flex items-start gap-3">
                <Monitor className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-white">Desktop (Chrome / Edge)</h4>
                  <p className="text-xs text-lavender-300/80 mt-1 leading-relaxed">
                    Look for the <strong>Install App (⊕)</strong> icon on the right side of your browser URL bar at the top, or click Menu (⋮) → <strong>Install KrewPlay</strong>.
                  </p>
                </div>
              </div>

              {/* iOS Safari Instruction */}
              <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10 flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-pink-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-white">Mobile (iOS / Safari)</h4>
                  <p className="text-xs text-lavender-300/80 mt-1 leading-relaxed">
                    Tap the <Share2 className="inline w-3.5 h-3.5 text-pink-400 mx-0.5" /> <strong>Share</strong> button at the bottom of Safari and choose <strong>"Add to Home Screen"</strong>.
                  </p>
                </div>
              </div>

              {/* Android Chrome Instruction */}
              <div className="p-4 rounded-xl bg-white/[0.04] border border-white/10 flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-white">Mobile (Android / Chrome)</h4>
                  <p className="text-xs text-lavender-300/80 mt-1 leading-relaxed">
                    Tap the browser <strong>Menu (⋮)</strong> in the top right corner and select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Footer */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="w-full md:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-semibold text-sm shadow-md transition-all cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}