import { Copy, LogOut } from "lucide-react";

type Props = {
  roomCode: string;
};

export default function TopBar({ roomCode }: Props) {
  function copyRoomCode() {
    navigator.clipboard.writeText(roomCode);
    alert("Room code copied!");
  }

  return (
    <div className="flex items-center justify-between bg-[#1A1A1A] border border-[#343434] rounded-xl p-4 mb-6">
      <h1 className="text-3xl font-bold text-white">
        🎬 KK Cine
      </h1>

      <div className="flex items-center gap-3">

        <span className="text-[#B497FF] font-semibold">
          Room : {roomCode}
        </span>

        <button
          onClick={copyRoomCode}
          className="bg-[#8A1538] hover:bg-[#6D1124] px-4 py-2 rounded-lg text-white flex items-center gap-2 transition"
        >
          <Copy size={18} />
          Copy
        </button>

        <button
          className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-white flex items-center gap-2 transition"
        >
          <LogOut size={18} />
          Leave
        </button>

      </div>
    </div>
  );
}