import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../../services/socket";
import { motion } from "framer-motion";
import { User, KeyRound, Tv, ChevronRight } from "lucide-react";
import { API_BASE_URL } from "../../config/api";

export default function Join() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem("user");
    if (!session) {
      navigate("/login");
    } else {
      const user = JSON.parse(session);
      setName(user.username);
    }
  }, [navigate]);

  async function joinRoom() {
    if (!name.trim() || !roomCode.trim()) {
      alert("Please enter your name and room code");
      return;
    }

    try {
      setLoading(true);
      const session = localStorage.getItem("user");
      const userData = session ? JSON.parse(session) : null;

      const res = await fetch(
        `${API_BASE_URL}/rooms/${roomCode}/join`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            userId: userData?.id,
            avatar: userData?.avatar,
          }),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        alert(error.message || "Failed to join room");
        return;
      }

      const data = await res.json();
      localStorage.setItem("participantId", data.participant.id);

      // Join the Socket.IO room
      socket.emit("join-room", {
        roomCode,
        participantId: data.participant.id,
      });

      // Navigate to the room page
      navigate(`/room/${roomCode}`);
    } catch (err) {
      console.error(err);
      alert("Failed to join room");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md border border-burgundy-900/40 bg-gradient-to-b from-burgundy-900/35 to-burgundy-950/60 p-8 md:p-10 rounded-3xl backdrop-blur-md shadow-2xl shadow-black/60 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-lavender-500/20 to-transparent" />
        
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-maroon-700 to-burgundy-900 text-lavender-300 shadow-md mb-4 border border-maroon-600/30">
            <Tv className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-lavender-50">
            Join Watch Party
          </h1>
          <p className="text-sm font-light text-lavender-200/50 mt-2">
            Enter a room code and nickname to join the synchronized stream.
          </p>
        </div>

        <div className="space-y-5">
          {/* Nickname Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold tracking-wider text-lavender-200/70 uppercase pl-1">
              Your Name
            </label>
            <div className="relative flex items-center">
              <User className="absolute left-4 text-lavender-400/50 h-5 w-5 pointer-events-none" />
              <input
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-burgundy-950/60 border border-burgundy-900/60 focus:border-lavender-400/60 focus:ring-2 focus:ring-lavender-400/10 text-lavender-100 placeholder-lavender-200/30 outline-none transition-all duration-300 text-sm"
                placeholder="Enter nickname..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          {/* Room Code Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold tracking-wider text-lavender-200/70 uppercase pl-1">
              Room Code
            </label>
            <div className="relative flex items-center">
              <KeyRound className="absolute left-4 text-lavender-400/50 h-5 w-5 pointer-events-none" />
              <input
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-burgundy-950/60 border border-burgundy-900/60 focus:border-lavender-400/60 focus:ring-2 focus:ring-lavender-400/10 text-lavender-100 placeholder-lavender-200/30 outline-none transition-all duration-300 uppercase tracking-widest text-sm"
                placeholder="ABCD12"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && joinRoom()}
              />
            </div>
          </div>

          <button
            onClick={joinRoom}
            disabled={loading}
            className="group w-full flex items-center justify-center gap-2 bg-gradient-to-r from-maroon-700 to-maroon-600 hover:from-maroon-600 hover:to-maroon-500 text-white font-bold py-4 rounded-2xl transition-all duration-300 hover:scale-[1.01] shadow-xl shadow-maroon-950/40 hover:shadow-maroon-850/20 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? "Joining..." : "Join Watch Room"}
            {!loading && <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />}
          </button>
        </div>
      </motion.div>
    </div>
  );
}