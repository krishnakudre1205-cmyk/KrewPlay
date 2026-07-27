import { useState } from "react";
import { Copy, Check, LogOut } from "lucide-react";

type Props = {
  roomCode: string;
  onLeave: () => void;
};

export default function TopBar({ roomCode, onLeave }: Props) {
  const [copied, setCopied] = useState(false);

  function copyRoomUrl() {
    const roomUrl = window.location.href;

    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(roomUrl)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {
          window.prompt("Copy the room URL:", roomUrl);
        });
      return;
    }

    window.prompt("Copy the room URL:", roomUrl);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-burgundy-900/20 border border-burgundy-900/40 rounded-2xl p-4 md:px-6 mb-6 backdrop-blur-sm shadow-xl">
      <div className="flex flex-wrap items-center justify-center gap-3">
        {/* Room badge */}
        <div className="rounded-xl bg-burgundy-950/80 border border-burgundy-900/60 px-4 py-2 text-sm font-semibold">
          <span className="text-lavender-300/60 font-light mr-1.5">Room:</span>
          <span className="text-lavender-200 font-black tracking-wider uppercase">{roomCode}</span>
        </div>

        {/* Copy url */}
        <button
          onClick={copyRoomUrl}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold tracking-wide border transition-all duration-300 cursor-pointer ${
            copied
              ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-400"
              : "bg-maroon-800/40 text-lavender-200 border-maroon-700/30 hover:bg-maroon-700 hover:text-white hover:shadow-lg hover:shadow-maroon-900/20"
          }`}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          <span>{copied ? "Copied" : "Copy URL"}</span>
        </button>

        {/* Leave */}
        <button
          onClick={onLeave}
          className="flex items-center gap-2 bg-red-950/20 hover:bg-red-950/40 text-red-400 hover:text-red-300 border border-red-900/30 hover:border-red-500/30 px-4 py-2.5 rounded-xl text-sm font-semibold tracking-wide transition-all duration-300 cursor-pointer"
        >
          <LogOut size={16} />
          Leave Party
        </button>
      </div>
    </div>
  );
}