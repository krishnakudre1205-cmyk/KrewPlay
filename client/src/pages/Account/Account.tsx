import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { API_BASE_URL } from "../../config/api";
import { 
  History, 
  Play, 
  Calendar, 
  FileVideo, 
  AlertTriangle, 
  Sparkles, 
  LogIn, 
  Film,
  ArrowRight,
  Trash2,
  Flame
} from "lucide-react";

type HistoryItem = {
  id: string;
  userId: string;
  movieName: string;
  filename: string;
  watchedAt: string;
  isHost?: boolean;
  coWatchers?: string[];
};

type FriendStreak = {
  name: string;
  currentStreak: number;
  maxStreak: number;
  watches: number;
};

type Stats = {
  totalWatched: number;
  totalHosted: number;
  totalUniqueFriends: number;
  maxCoWatchers: number;
  overallMaxStreak: number;
};

const femaleAvatars = [
  { emoji: "👩‍🦰", gradient: "from-[#ec4899] to-[#f43f5e]", name: "Red Hair Girl" },
  { emoji: "👩‍🦳", gradient: "from-[#a855f7] to-[#ec4899]", name: "Blonde Hair Girl" },
  { emoji: "👩‍🦱", gradient: "from-[#3b82f6] to-[#6366f1]", name: "Curly Hair Girl" },
  { emoji: "👧", gradient: "from-[#10b981] to-[#14b8a6]", name: "Young Girl" },
  { emoji: "👩‍💼", gradient: "from-[#f43f5e] to-[#e11d48]", name: "Office Girl" },
  { emoji: "👩‍⚕️", gradient: "from-[#ec4899] to-[#d946ef]", name: "Doctor Girl" },
];

const maleAvatars = [
  { emoji: "🧑‍🦰", gradient: "from-[#f97316] to-[#ef4444]", name: "Red Hair Boy" },
  { emoji: "🧑‍🦳", gradient: "from-[#6366f1] to-[#8b5cf6]", name: "Blonde Hair Boy" },
  { emoji: "🧑‍🦱", gradient: "from-[#06b6d4] to-[#3b82f6]", name: "Curly Hair Boy" },
  { emoji: "👦", gradient: "from-[#84cc16] to-[#10b981]", name: "Young Boy" },
  { emoji: "🧑‍💼", gradient: "from-[#64748b] to-[#475569]", name: "Office Boy" },
  { emoji: "🧑‍🚀", gradient: "from-[#8b5cf6] to-[#d946ef]", name: "Astronaut" },
];

export default function Account() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ id: string; username: string; avatar?: { emoji: string; gradient: string } } | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [streaks, setStreaks] = useState<FriendStreak[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalWatched: 0,
    totalHosted: 0,
    totalUniqueFriends: 0,
    maxCoWatchers: 0,
    overallMaxStreak: 0
  });

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem("user");
    if (!session) {
      setLoading(false);
      return;
    }

    const userData = JSON.parse(session);
    setUser(userData);
    fetchData(userData.id);
  }, []);

  async function fetchData(userId: string) {
    try {
      const achievementsRes = await fetch(`${API_BASE_URL}/auth/achievements/${userId}`);
      if (!achievementsRes.ok) throw new Error("Failed to load achievements");
      const achievementsData = await achievementsRes.json();
      
      setStats(achievementsData.stats);
      setStreaks(achievementsData.friendStreaks || []);

      const historyRes = await fetch(`${API_BASE_URL}/auth/history/${userId}`);
      if (!historyRes.ok) throw new Error("Failed to load history");
      const historyData = await historyRes.json();
      setHistory(historyData.history || []);

    } catch (err) {
      console.error(err);
      setError("Unable to retrieve account updates.");
    } finally {
      setLoading(false);
    }
  }

  async function handleClearHistory() {
    if (!user || history.length === 0) return;
    if (!window.confirm("Are you sure you want to clear your entire watch history?")) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/auth/history/${user.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to clear history");
      setHistory([]);
    } catch (err) {
      console.error(err);
      alert("Failed to clear watch history");
    }
  }

  async function handleSelectAvatar(avatar: { emoji: string; gradient: string }) {
    if (!user) return;
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/auth/avatar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          avatar,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to update avatar");
      }

      const updatedUser = { ...user, avatar: data.user.avatar };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setAvatarModalOpen(false);

      window.dispatchEvent(new Event("storage"));
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error saving avatar selection.");
    }
  }

  async function handleWatchAgain(item: HistoryItem) {
    if (!user) return;
    
    setActionLoading(item.id);
    setError("");

    try {
      const res = await fetch(`${API_BASE_URL}/auth/recreate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          movieName: item.movieName,
          filename: item.filename,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Failed to recreate watch room.");
        setActionLoading(null);
        return;
      }

      localStorage.setItem("participantId", data.participantId);
      navigate(`/room/${data.roomCode}`);
    } catch (err) {
      console.error(err);
      alert("Error starting movie session.");
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center py-20">
        <div className="relative flex items-center justify-center">
          <div className="h-16 w-16 animate-spin rounded-full border-4 border-lavender-400/20 border-t-lavender-400" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-20 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md border border-burgundy-900/40 bg-gradient-to-b from-burgundy-900/35 to-burgundy-950/60 p-8 text-center rounded-3xl backdrop-blur-md shadow-2xl"
        >
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-burgundy-900/40 border border-burgundy-800/30 text-lavender-300 mb-5">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold text-lavender-50">Sign In Required</h2>
          <p className="text-sm font-light text-lavender-200/50 mt-2 mb-6">
            You must be logged in to view your streaks, badges, and history.
          </p>
          <Link
            to="/login"
            className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-maroon-700 to-maroon-600 hover:from-maroon-600 hover:to-maroon-500 text-white font-bold py-3.5 rounded-2xl transition duration-300 shadow-lg shadow-maroon-950/50"
          >
            <LogIn className="h-4.5 w-4.5" />
            <span>Login / Register</span>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-5xl w-full mx-auto px-6 py-12 relative z-10">
      
      {/* Profile Header */}
      <div className="flex flex-col md:flex-row items-center gap-6 bg-burgundy-900/20 border border-burgundy-900/40 rounded-3xl p-6 md:p-8 mb-8 backdrop-blur-sm shadow-xl">
        
        {/* Hoverable avatar edit container */}
        <div className="relative group/avatar">
          {user.avatar ? (
            <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${user.avatar.gradient} flex items-center justify-center text-4.5xl shadow-lg shadow-black/30 select-none transition-all duration-300 group-hover/avatar:scale-[1.03]`}>
              {user.avatar.emoji}
            </div>
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-maroon-700 to-lavender-650 flex items-center justify-center font-black text-3xl text-white shadow-lg shadow-black/30 select-none transition-all duration-300 group-hover/avatar:scale-[1.03]">
              {user.username.charAt(0).toUpperCase()}
            </div>
          )}
          
          <button 
            onClick={() => setAvatarModalOpen(true)}
            className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-xl bg-burgundy-950 border border-burgundy-900/80 hover:border-lavender-550/55 flex items-center justify-center text-lavender-300 hover:text-white shadow-lg transition duration-300 cursor-pointer"
            title="Edit Avatar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
        </div>

        <div className="flex-1 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-maroon-900/40 px-3 py-1 text-xs font-semibold text-lavender-300 border border-maroon-800/30">
            <Sparkles className="h-3 w-3" /> Premium Watcher
          </div>
          <h1 className="text-3xl font-extrabold text-lavender-50 mt-1">{user.username}</h1>
          <p className="text-xs text-lavender-350 mt-0.5">KrewPlay Cinema Member</p>
        </div>
        <div className="flex flex-col sm:flex-row md:flex-col gap-3.5 w-full md:w-auto">
          <Link
            to="/host"
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-maroon-700 to-maroon-600 hover:from-maroon-600 hover:to-maroon-500 border border-maroon-600/30 text-white font-black px-6 py-3.5 rounded-2xl text-xs tracking-wider uppercase shadow-md shadow-maroon-900/10 hover:shadow-lg hover:shadow-maroon-950/20 transition duration-300 hover:scale-[1.02] cursor-pointer"
          >
            <Film size={15} />
            <span>Host Movie Party</span>
          </Link>

          <Link
            to="/join"
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-lavender-500 to-lavender-600 hover:from-lavender-450 hover:to-lavender-550 border border-lavender-500/20 text-burgundy-950 font-black px-6 py-3.5 rounded-2xl text-xs tracking-wider uppercase shadow-md shadow-lavender-500/5 hover:shadow-lg hover:shadow-lavender-500/15 transition duration-300 hover:scale-[1.02] cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6"/><rect width="8" height="6" x="2" y="14" rx="1"/><path d="M6 14a2 2 0 0 1 2 2"/></svg>
            <span>Join Movie Party</span>
          </Link>
        </div>
      </div>

      {/* Numerical Stats Widgets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-burgundy-950/45 border border-burgundy-900/50 rounded-2xl p-4.5 text-center shadow-md">
          <p className="text-xs text-lavender-300/40 uppercase tracking-wider font-semibold">Movies Watched</p>
          <p className="text-3xl font-black text-lavender-100 mt-1">{stats.totalWatched}</p>
        </div>
        <div className="bg-burgundy-950/45 border border-burgundy-900/50 rounded-2xl p-4.5 text-center shadow-md">
          <p className="text-xs text-lavender-300/40 uppercase tracking-wider font-semibold">Rooms Hosted</p>
          <p className="text-3xl font-black text-lavender-100 mt-1">{stats.totalHosted}</p>
        </div>
        <div className="bg-burgundy-950/45 border border-burgundy-900/50 rounded-2xl p-4.5 text-center shadow-md">
          <p className="text-xs text-lavender-300/40 uppercase tracking-wider font-semibold">Co-Watchers Met</p>
          <p className="text-3xl font-black text-lavender-100 mt-1">{stats.totalUniqueFriends}</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 text-red-400 bg-red-950/20 border border-red-500/20 rounded-xl px-4 py-3 text-xs">
          <AlertTriangle className="h-4.5 w-4.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Snapchat Friend Streaks Section (No Expiry) */}
      {streaks.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 text-lavender-200 font-bold text-base md:text-lg mb-4">
            <Flame size={20} className="text-orange-500 fill-current" />
            <span>Friend Watch Streaks</span>
            <span className="text-[11px] font-semibold text-orange-400 bg-orange-950/40 border border-orange-500/30 px-2.5 py-0.5 rounded-full ml-1">
              Never Expires
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {streaks.map((streak) => (
              <div
                key={streak.name}
                className="flex items-center justify-between bg-burgundy-950/60 border border-burgundy-900/60 hover:border-orange-500/40 rounded-2xl p-3.5 transition duration-300 shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-600 to-rose-600 flex items-center justify-center font-black text-sm text-white shadow-md flex-shrink-0">
                    {streak.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-lavender-100 truncate" title={streak.name}>
                      {streak.name}
                    </p>
                    <p className="text-[10px] text-lavender-300/40 truncate">
                      {streak.watches} {streak.watches === 1 ? "session" : "sessions"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-orange-500 font-black text-sm bg-orange-950/40 border border-orange-500/30 px-2.5 py-1 rounded-xl flex-shrink-0">
                  <Flame size={14} className="fill-current animate-pulse" />
                  <span>{streak.currentStreak}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Watch History Header with Clear History button */}
      <div className="flex items-center justify-between border-b border-burgundy-900/40 mb-6 pb-4">
        <div className="flex items-center gap-2 text-lavender-200 font-bold text-base md:text-lg">
          <History size={20} className="text-rose-400" />
          <span>Watch History ({history.length})</span>
        </div>

        {history.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 hover:border-red-500 text-red-300 hover:text-white text-xs font-semibold transition duration-200 cursor-pointer shadow-sm"
          >
            <Trash2 size={14} />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* Watch History List */}
      <div className="space-y-4">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-12 bg-burgundy-950/30 border border-dashed border-burgundy-900/50 rounded-2xl text-lavender-300/40">
            <FileVideo className="h-16 w-16 stroke-1 mb-4" />
            <h3 className="text-base font-bold text-lavender-200">No movies watched yet</h3>
            <p className="text-xs font-light text-lavender-300/50 max-w-sm mt-1 mb-6">
              Movies will automatically appear here once you host or join watch party streams.
            </p>
            <Link
              to="/host"
              className="flex items-center gap-1 bg-burgundy-950 hover:bg-burgundy-900 border border-burgundy-900/60 px-4 py-2 rounded-xl text-xs font-bold text-lavender-200 transition"
            >
              <span>Host Room</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          history.map((item) => (
            <div
              key={item.id}
              className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-burgundy-950/45 border border-burgundy-900/50 hover:border-burgundy-900/90 rounded-2xl p-5 transition duration-300"
            >
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 flex items-center justify-center rounded-xl bg-maroon-900/20 border border-maroon-800/20 text-lavender-300 flex-shrink-0">
                  <FileVideo className="h-5.5 w-5.5" />
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="text-sm md:text-base font-bold text-lavender-50 break-words pr-2">
                    {item.movieName}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-lavender-300/50 font-light flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} />
                      <span>
                        {new Date(item.watchedAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <span>•</span>
                    {item.isHost ? (
                      <span className="text-maroon-500 font-semibold uppercase tracking-wider text-[10px]">Hosted 👑</span>
                    ) : (
                      <span className="text-lavender-400 font-semibold uppercase tracking-wider text-[10px]">Joined 👥</span>
                    )}
                    {item.coWatchers && item.coWatchers.length > 0 && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1.5 flex-wrap">
                          <span>with</span>
                          {item.coWatchers.map((name) => {
                            const foundStreak = streaks.find((s) => s.name === name);
                            return (
                              <span
                                key={name}
                                className="inline-flex items-center gap-1 bg-burgundy-950/80 border border-burgundy-900/60 px-2 py-0.5 rounded-lg text-lavender-200"
                              >
                                <span>{name}</span>
                                {foundStreak && foundStreak.currentStreak > 0 && (
                                  <span className="inline-flex items-center gap-0.5 text-orange-500 font-bold ml-0.5">
                                    <Flame size={11} className="fill-current" />
                                    <span>{foundStreak.currentStreak}</span>
                                  </span>
                                )}
                              </span>
                            );
                          })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-auto">
                <button
                  disabled={actionLoading !== null}
                  onClick={() => handleWatchAgain(item)}
                  className="flex items-center gap-2 bg-maroon-800/40 hover:bg-maroon-700 text-lavender-100 hover:text-white border border-maroon-700/30 px-4 py-2.5 rounded-xl text-xs font-bold transition duration-300 shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {actionLoading === item.id ? (
                    <span>Preparing...</span>
                  ) : (
                    <>
                      <Play size={13} className="fill-current" />
                      <span>Watch Again</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Avatar Picker Modal */}
      {avatarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg border border-burgundy-900/40 bg-[#16030e]/95 p-6 md:p-8 rounded-3xl backdrop-blur-md shadow-2xl relative"
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-lavender-50">Choose Profile Avatar</h3>
                <p className="text-xs font-light text-lavender-300/40 mt-1">Choose a cartoon character to personalize your presence.</p>
              </div>
              <button 
                onClick={() => setAvatarModalOpen(false)}
                className="text-lavender-350 hover:text-white transition cursor-pointer text-xl p-1"
              >
                ✕
              </button>
            </div>

            {/* Female Avatars */}
            <div className="mb-6">
              <h4 className="text-xs font-bold text-lavender-200/50 uppercase tracking-wider pl-1 mb-3">Female Characters</h4>
              <div className="grid grid-cols-6 gap-3">
                {femaleAvatars.map((av, idx) => (
                  <button
                    key={`female-${idx}`}
                    onClick={() => handleSelectAvatar(av)}
                    className="aspect-square rounded-2xl bg-burgundy-950/60 border border-burgundy-900/40 hover:border-lavender-450/60 flex items-center justify-center text-3xl transition-all duration-300 hover:scale-[1.08] hover:shadow-lg shadow-black/20 cursor-pointer overflow-hidden p-1"
                    title={av.name}
                  >
                    <div className={`w-full h-full rounded-xl bg-gradient-to-br ${av.gradient} flex items-center justify-center`}>
                      {av.emoji}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Male Avatars */}
            <div className="mb-6">
              <h4 className="text-xs font-bold text-lavender-200/50 uppercase tracking-wider pl-1 mb-3">Male Characters</h4>
              <div className="grid grid-cols-6 gap-3">
                {maleAvatars.map((av, idx) => (
                  <button
                    key={`male-${idx}`}
                    onClick={() => handleSelectAvatar(av)}
                    className="aspect-square rounded-2xl bg-burgundy-950/60 border border-burgundy-900/40 hover:border-lavender-450/60 flex items-center justify-center text-3xl transition-all duration-300 hover:scale-[1.08] hover:shadow-lg shadow-black/20 cursor-pointer overflow-hidden p-1"
                    title={av.name}
                  >
                    <div className={`w-full h-full rounded-xl bg-gradient-to-br ${av.gradient} flex items-center justify-center`}>
                      {av.emoji}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setAvatarModalOpen(false)}
                className="bg-burgundy-950 hover:bg-burgundy-900 text-lavender-350 hover:text-white px-5 py-2.5 rounded-xl text-xs font-bold border border-burgundy-900/55 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
