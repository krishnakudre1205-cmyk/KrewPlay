import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, Tv, Users, MessageSquare, Volume2, ShieldAlert, FileVideo, ChevronRight, X } from "lucide-react";
import logoImg from "../../assets/logo.png";
import { API_BASE_URL } from "../../config/api";
import { socket } from "../../services/socket";
import { toast } from "react-hot-toast";

export default function Home() {
  const navigate = useNavigate();
  const [continueWatching, setContinueWatching] = useState<any[]>([]);

  const fetchContinueWatching = async () => {
    const session = localStorage.getItem("user");
    if (!session) return;
    const user = JSON.parse(session);
    try {
      const res = await fetch(`${API_BASE_URL}/movies/continue-watching/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setContinueWatching(data.list?.filter((r: any) => !r.completed) || []);
      }
    } catch (err) {
      console.error("Error fetching continue watching list:", err);
    }
  };

  useEffect(() => {
    fetchContinueWatching();
  }, []);

  const handleResume = async (record: any) => {
    if (record.lastRoomCode) {
      try {
        const checkRoom = await fetch(`${API_BASE_URL}/rooms/${record.lastRoomCode}`);
        if (checkRoom.ok) {
          localStorage.setItem("resume-timestamp", record.currentPosition.toString());
          navigate(`/room/${record.lastRoomCode}`);
          return;
        }
      } catch (err) {
        console.error("Error checking room availability:", err);
      }
    }

    try {
      const session = localStorage.getItem("user");
      const userData = session ? JSON.parse(session) : null;
      if (!userData) {
        navigate("/login");
        return;
      }

      const res = await fetch(`${API_BASE_URL}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostName: userData.username,
          userId: userData.id,
          avatar: userData.avatar,
        }),
      });
      if (!res.ok) throw new Error("Failed to create room");
      const room = await res.json();
      
      localStorage.setItem("participantId", room.participants[0].id);

      socket.emit("join-room", {
        roomCode: room.code,
        participantId: room.participants[0].id,
      });

      const selectRes = await fetch(`${API_BASE_URL}/movies/${room.code}/select-library`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ libraryId: record.movieId }),
      });
      if (!selectRes.ok) throw new Error("Failed to select library movie");

      localStorage.setItem("resume-timestamp", record.currentPosition.toString());
      navigate(`/room/${room.code}`);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to resume playback: " + err.message);
    }
  };

  const removeContinueWatching = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) return;
      const user = JSON.parse(userStr);
      
      const res = await fetch(`${API_BASE_URL}/movies/continue-watching/${user.id}/${id}`, {
        method: "DELETE"
      });
      
      if (res.ok) {
        setContinueWatching(prev => prev.filter(item => item.id !== id));
        toast.success("Removed from Continue Watching", { icon: "🗑️" });
      }
    } catch (err) {
      toast.error("Failed to remove item");
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" as const } },
  };

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: "easeOut" as const } },
  };

  const features = [
    {
      icon: <Tv className="text-lavender-400 h-6 w-6" />,
      title: "Real-Time Sync",
      desc: "Perfectly synchronized movie streams. When the host pauses or seeks, everyone's player stays completely in lockstep.",
    },
    {
      icon: <MessageSquare className="text-lavender-400 h-6 w-6" />,
      title: "Instant Live Chat",
      desc: "React to the plot twists instantly. Share emojis, quick status pills, and text messages inside the cinema room.",
    },
    {
      icon: <Volume2 className="text-lavender-400 h-6 w-6" />,
      title: "Low-Latency Voice",
      desc: "Talk with your crew using our built-in low-latency audio network. Laugh and scream together as the story unfolds.",
    },
    {
      icon: <ShieldAlert className="text-lavender-400 h-6 w-6" />,
      title: "Host Lock Rights",
      desc: "Ensure uninterrupted viewings. Host can lock video player controls to prevent accidental skips or interruptions.",
    },
  ];

  return (
    <div className="flex flex-col items-center px-6 py-12 md:py-20 lg:py-24 relative z-10 w-full max-w-7xl mx-auto flex-1">
      {/* Hero Section */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="text-center max-w-4xl flex flex-col items-center mb-16 md:mb-24"
      >
        <motion.div variants={itemVariants} className="mb-8">
          <img 
            src={logoImg} 
            alt="KrewPlay Logo" 
            className="h-28 md:h-36 w-auto object-contain select-none filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.6)]" 
          />
        </motion.div>

        <motion.div 
          variants={itemVariants} 
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-maroon-800/40 bg-burgundy-900/30 px-4 py-1.5 text-xs font-semibold tracking-wider text-lavender-200 uppercase"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-maroon-500" />
          The Ultimate Movie Room
        </motion.div>

        <motion.h1
          variants={itemVariants}
          className="mb-8 text-5xl md:text-7xl font-black tracking-tight leading-[1.1] text-lavender-50"
        >
          Watch Movies
          <span className="block mt-2 bg-gradient-to-r from-maroon-500 via-maroon-400 to-lavender-300 bg-clip-text text-transparent">
            Together In Perfect Sync
          </span>
        </motion.h1>

        <motion.p
          variants={itemVariants}
          className="mb-12 text-lg md:text-xl text-lavender-200/70 max-w-2xl font-light leading-relaxed"
        >
          Stream local files with friends from anywhere in the world. Enjoy low-latency voice, live messaging, and interactive reactions.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-5 justify-center w-full sm:w-auto">
          <Link
            to="/host"
            className="group relative flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-maroon-700 to-maroon-600 px-8 py-4.5 text-lg font-bold text-white transition-all duration-300 hover:from-maroon-600 hover:to-maroon-500 shadow-xl shadow-maroon-950/40 hover:shadow-maroon-700/20 hover:scale-[1.02]"
          >
            <Play className="h-5 w-5 fill-current" />
            Host Watch Room
            <div className="absolute -inset-0.5 rounded-2xl bg-lavender-400/10 opacity-0 blur group-hover:opacity-100 transition-opacity duration-300" />
          </Link>

          <Link
            to="/join"
            className="flex items-center justify-center gap-2.5 rounded-2xl border border-lavender-500/20 bg-burgundy-900/10 backdrop-blur-md px-8 py-4.5 text-lg font-semibold text-lavender-200 transition-all duration-300 hover:border-lavender-400/40 hover:bg-lavender-500/5 hover:text-lavender-50 hover:scale-[1.02]"
          >
            <Users className="h-5 w-5" />
            Join Watch Party
          </Link>
        </motion.div>
      </motion.div>

      {/* Continue Watching Section */}
      {continueWatching.length > 0 && (
        <div className="w-full mb-16 text-left relative z-20">
          <h2 className="text-sm font-bold uppercase tracking-wider text-lavender-200/50 mb-6 flex items-center gap-1.5 pl-1">
            <Play className="h-4 w-4 text-maroon-500 fill-current" />
            <span>Continue Watching</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {continueWatching.map((item) => {
              const remainingSec = item.duration - item.currentPosition;
              const remainingMin = Math.ceil(remainingSec / 60);
              return (
                <div key={item.id} className="bg-burgundy-950/60 border border-burgundy-900/50 rounded-2xl overflow-hidden hover:border-maroon-700/40 hover:shadow-lg transition-all group flex flex-col justify-between">
                  <div className="relative aspect-video bg-black flex-shrink-0">
                    {item.poster ? (
                      <img src={item.poster} alt={item.movieTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-burgundy-950 text-lavender-400">
                        <FileVideo className="h-10 w-10 opacity-30" />
                      </div>
                    )}
                    {/* Play Overlay */}
                    <button
                      onClick={() => handleResume(item)}
                      className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer"
                    >
                      <div className="h-11 w-11 flex items-center justify-center rounded-full bg-maroon-700 text-white shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-300">
                        <Play className="h-5 w-5 fill-current ml-0.5" />
                      </div>
                    </button>

                    {/* Remove Button */}
                    <button
                      onClick={(e) => removeContinueWatching(e, item.id)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white/70 hover:text-white hover:bg-maroon-600 opacity-0 group-hover:opacity-100 transition-all duration-300 z-10"
                      title="Remove from list"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    
                    {/* Progress Bar */}
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-burgundy-900/60">
                      <div className="bg-maroon-600 h-full" style={{ width: `${item.progressPercentage || 0}%` }}></div>
                    </div>
                  </div>
                  
                  <div className="p-4 flex-1 flex flex-col justify-between gap-2.5">
                    <div>
                      <h3 className="text-sm font-bold text-lavender-100 truncate capitalize" title={item.movieTitle}>
                        {item.movieTitle.replace(/[-._]/g, " ").replace(/\.(mp4|mkv|avi|webm|mov)$/i, "")}
                      </h3>
                      <p className="text-[10px] text-lavender-300/45 font-medium mt-0.5">
                        Last watched: {new Date(item.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[11px] font-semibold">
                      <span className="text-lavender-300/70">{remainingMin} min left</span>
                      <button
                        onClick={() => handleResume(item)}
                        className="text-maroon-400 hover:text-maroon-355 flex items-center gap-0.5 cursor-pointer font-bold"
                      >
                        Resume
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Feature Section */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full"
      >
        {features.map((feat, idx) => (
          <motion.div
            key={idx}
            variants={cardVariants}
            whileHover={{ y: -8, transition: { duration: 0.3 } }}
            className="relative overflow-hidden rounded-2xl border border-burgundy-900/40 bg-gradient-to-b from-burgundy-900/20 to-burgundy-950/40 p-6 md:p-8 backdrop-blur-sm"
          >
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-lavender-400/10 to-transparent" />
            
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-maroon-950/80 border border-maroon-900/30 text-lavender-300 shadow-inner">
              {feat.icon}
            </div>
            
            <h3 className="mb-3 text-lg font-bold tracking-wide text-lavender-100">{feat.title}</h3>
            <p className="text-sm font-light leading-relaxed text-lavender-200/50">{feat.desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}