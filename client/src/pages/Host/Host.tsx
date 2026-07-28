import { useState, useEffect, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

import { socket } from "../../services/socket";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FileVideo, 
  CheckCircle2, 
  Play,
  ChevronRight, 
  Copy, 
  Check, 
  User, 
  Sparkles,
  Search,
  Trash2,
  Edit2,
  PlayCircle,
  FolderMinus,
  UploadCloud,
  Loader2,
  X
} from "lucide-react";
import { API_BASE_URL } from "../../config/api";

interface LibraryEntry {
  id: string;
  userId: string;
  movieName: string;
  originalFilename: string;
  size: number;
  uploadedAt: string;
  status?: "processing" | "ready";
}

export default function Host() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [userId, setUserId] = useState("");
  const [roomCode, setRoomCode] = useState("");

  useEffect(() => {
    const session = localStorage.getItem("user");
    if (!session) {
      navigate("/login");
      return;
    }
    const userData = JSON.parse(session);
    setName(userData.username);
    setUserId(userData.id);
    fetchContinueWatching(userData.id);
  }, [navigate]);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadLoaded, setUploadLoaded] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);

  const [roomCreated, setRoomCreated] = useState(false);
  const [uploading, setUploading] = useState(false); // Used generally for loading state of actions
  const [uploaded, setUploaded] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const [streamMode, setStreamMode] = useState<"library" | "upload" | "url">("library");
  const [videoUrl, setVideoUrl] = useState("");
  const [customName, setCustomName] = useState("");

  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "name" | "size">("date");
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [continueWatching, setContinueWatching] = useState<any[]>([]);

  const fetchContinueWatching = async (uid = userId) => {
    if (!uid) return;
    try {
      const res = await fetch(`${API_BASE_URL}/movies/continue-watching/${uid}`);
      if (res.ok) {
        const data = await res.json();
        setContinueWatching(data.list?.filter((r: any) => !r.completed) || []);
      }
    } catch (err) {
      console.error("Error fetching continue watching list:", err);
    }
  };

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
      if (!userId) {
        navigate("/login");
        return;
      }

      const res = await fetch(`${API_BASE_URL}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostName: name,
          userId,
          avatar: localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")!).avatar : undefined,
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
      const res = await fetch(`${API_BASE_URL}/movies/continue-watching/${userId}/${id}`, {
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

  // Poll library to check if any processing movies are done
  useEffect(() => {
    if (streamMode === "library" && library.some(m => m.status === "processing")) {
      const interval = setInterval(() => {
        fetchLibrary();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [streamMode, library, userId]);

  function formatBytes(bytes: number) {
    if (bytes === 0) return "0 MB";
    const mb = bytes / 1024 / 1024;
    if (mb >= 1024) {
      return (mb / 1024).toFixed(2) + " GB";
    }
    return mb.toFixed(2) + " MB";
  }

  async function createRoom() {
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }

    try {
      const session = localStorage.getItem("user");
      const userData = session ? JSON.parse(session) : null;

      const res = await fetch(`${API_BASE_URL}/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          hostName: name,
          userId: userData?.id,
          avatar: userData?.avatar,
        }),
      });

      const data = await res.json();
      localStorage.setItem("participantId", data.participants[0].id);

      socket.emit("join-room", {
        roomCode: data.code,
        participantId: data.participants[0].id,
      });

      setRoomCode(data.code);
      setRoomCreated(true);
      fetchLibrary(userData?.id);
      toast.success("Watch room created successfully!", { icon: "🎉" });
    } catch (err) {
      console.error(err);
      toast.error("Failed to create room");
    }
  }

  async function fetchLibrary(uid = userId) {
    if (!uid) return;
    setLoadingLibrary(true);
    try {
      const res = await fetch(`${API_BASE_URL}/library/${uid}`);
      if (res.ok) {
        const data = await res.json();
        setLibrary(data);
      }
    } catch (err) {
      console.error("Failed to load library:", err);
    } finally {
      setLoadingLibrary(false);
    }
  }

  function onFileChange(file: File | null) {
    if (!file) return;
    setSelectedFile(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      onFileChange(e.dataTransfer.files[0]);
    }
  }

  async function uploadMovieToLibrary() {
    if (!selectedFile) {
      toast.error("Please select a movie file first");
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      setUploadLoaded(0);
      setUploadTotal(selectedFile.size);

      // 1. Initialize
      const initRes = await fetch(`${API_BASE_URL}/library/${userId}/upload/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: selectedFile.name, size: selectedFile.size })
      });
      if (!initRes.ok) throw new Error("Failed to initialize upload");
      const { uploadId } = await initRes.json();

      // 2. Upload Chunks (5MB each)
      const chunkSize = 5 * 1024 * 1024;
      const totalChunks = Math.ceil(selectedFile.size / chunkSize);
      let loaded = 0;

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, selectedFile.size);
        const chunk = selectedFile.slice(start, end);

        const chunkRes = await fetch(`${API_BASE_URL}/library/${userId}/upload/chunk/${uploadId}`, {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: chunk
        });

        if (!chunkRes.ok) throw new Error(`Failed to upload chunk ${i}`);

        loaded += chunk.size;
        setUploadLoaded(loaded);
        setUploadProgress(Math.min(100, Math.round((loaded * 100) / selectedFile.size)));
      }

      // 3. Finalize and check duplicate
      const completeRes = await fetch(`${API_BASE_URL}/library/${userId}/upload/complete/${uploadId}`, {
        method: "POST"
      });

      if (!completeRes.ok) {
        const errData = await completeRes.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to finalize upload");
      }
      
      setUploadProgress(100);
      setUploadLoaded(selectedFile.size);
      
      setSelectedFile(null);
      await fetchLibrary();
      setStreamMode("library");
      toast.success("Movie uploaded successfully! Metadata is being processed.", { icon: "🎬" });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function setSharedMovieUrl(urlToUse: string, nameToUse: string) {
    if (!urlToUse.trim()) {
      alert("Please enter a valid video stream URL");
      return;
    }
    try {
      setUploading(true);
      const res = await fetch(`${API_BASE_URL}/movies/${roomCode}/set-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movieUrl: urlToUse,
          movieName: nameToUse || "Direct Video Stream",
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to set movie stream");
      }
      setUploaded(true);
    } catch (err: any) {
      console.error(err);
      alert("Failed to set video URL: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  async function hostLibraryMovie(libraryId: string) {
    try {
      setUploading(true);
      const res = await fetch(`${API_BASE_URL}/movies/${roomCode}/select-library`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ libraryId }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to select library movie");
      }
      setUploaded(true);
    } catch (err: any) {
      console.error(err);
      alert("Failed to select movie: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  async function deleteLibraryMovie(libraryId: string, isPermanent: boolean) {
    const message = isPermanent 
      ? "Are you sure you want to permanently delete this movie from disk? This cannot be undone."
      : "Are you sure you want to remove this movie from your Library view? (The file stays on disk)";
      
    if (!confirm(message)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/library/${userId}/${libraryId}?permanent=${isPermanent}`, { method: "DELETE" });
      if (res.ok) {
        setLibrary(library.filter(m => m.id !== libraryId));
        if (isPermanent) {
          toast.success("Movie permanently deleted from disk.", { icon: "🗑️" });
        } else {
          toast.success("Movie removed from Library view.", { icon: "📂" });
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete movie.");
    }
  }

  async function renameLibraryMovie(libraryId: string, currentName: string) {
    const newName = prompt("Enter new name for the movie (does not rename physical file):", currentName);
    if (!newName || newName === currentName) return;
    try {
      const res = await fetch(`${API_BASE_URL}/library/${userId}/${libraryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieName: newName }),
      });
      if (res.ok) {
        fetchLibrary();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to rename movie.");
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const filteredLibrary = library
    .filter(m => m.movieName.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "date") return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
      if (sortBy === "name") return a.movieName.localeCompare(b.movieName);
      if (sortBy === "size") return b.size - a.size;
      return 0;
    });

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-2xl border border-burgundy-900/40 bg-gradient-to-b from-burgundy-900/35 to-burgundy-950/60 p-8 md:p-10 rounded-3xl backdrop-blur-md shadow-2xl shadow-black/60 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-lavender-500/20 to-transparent" />
        
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-maroon-700 to-burgundy-900 text-lavender-300 shadow-md mb-4 border border-maroon-600/30">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-lavender-50">
            {roomCreated ? "Select Media" : "Create Watch Room"}
          </h1>
          <p className="text-sm font-light text-lavender-200/50 mt-2">
            {roomCreated 
              ? "Share the room code and select a video to begin the show." 
              : "Enter your nickname to establish a synchronized viewing session."}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {!roomCreated ? (
            <motion.div
              key="setup"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <label className="text-xs font-semibold tracking-wider text-lavender-200/70 uppercase pl-1">
                  Host Nickname
                </label>
                <div className="relative flex items-center">
                  <User className="absolute left-4 text-lavender-400/50 h-5 w-5 pointer-events-none" />
                  <input
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-burgundy-950/60 border border-burgundy-900/60 focus:border-lavender-400/60 focus:ring-2 focus:ring-lavender-400/10 text-lavender-100 placeholder-lavender-200/30 outline-none transition-all duration-300"
                    placeholder="Enter your name..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createRoom()}
                  />
                </div>
              </div>

              <button
                onClick={createRoom}
                className="group w-full flex items-center justify-center gap-2 bg-gradient-to-r from-maroon-700 to-maroon-600 hover:from-maroon-600 hover:to-maroon-500 text-white font-bold py-4 rounded-2xl transition-all duration-300 hover:scale-[1.01] shadow-xl shadow-maroon-950/40 hover:shadow-maroon-850/20"
              >
                Create Session
                <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="upload"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              {/* Room Code Badge */}
              <div className="flex items-center justify-between rounded-2xl bg-burgundy-950/80 border border-burgundy-900/50 px-5 py-4">
                <div>
                  <p className="text-xs font-semibold text-lavender-200/50 uppercase tracking-wider">
                    Share Room Code
                  </p>
                  <p className="text-2xl font-black text-lavender-300 tracking-wider mt-1">
                    {roomCode}
                  </p>
                </div>
                <button
                  onClick={copyCode}
                  className={`flex h-11 items-center gap-2 px-4 rounded-xl border transition-all duration-300 ${
                    copied 
                      ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-400"
                      : "bg-maroon-900/20 border-maroon-700/30 text-lavender-200 hover:bg-maroon-800/40 hover:text-white"
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="h-4.5 w-4.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4.5 w-4.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Mode Selection Tabs */}
              <div className="grid grid-cols-3 gap-2 bg-burgundy-950/60 p-1.5 rounded-xl border border-burgundy-900/40">
                <button
                  type="button"
                  onClick={() => { setStreamMode("library"); setUploaded(false); }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    streamMode === "library"
                      ? "bg-maroon-700 text-white shadow-md"
                      : "text-lavender-200/60 hover:text-white"
                  }`}
                >
                  📚 My Library
                </button>
                <button
                  type="button"
                  onClick={() => { setStreamMode("upload"); setUploaded(false); }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    streamMode === "upload"
                      ? "bg-maroon-700 text-white shadow-md"
                      : "text-lavender-200/60 hover:text-white"
                  }`}
                >
                  📁 Upload New
                </button>
                <button
                  type="button"
                  onClick={() => { setStreamMode("url"); setUploaded(false); }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    streamMode === "url"
                      ? "bg-maroon-700 text-white shadow-md"
                      : "text-lavender-200/60 hover:text-white"
                  }`}
                >
                  🔗 URL
                </button>
              </div>

              {/* MY LIBRARY MODE */}
              {streamMode === "library" && !uploaded && (
                <div className="space-y-4 rounded-2xl bg-burgundy-950/40 border border-burgundy-900/40 p-5">
                  {/* Continue Watching shelf inside Library */}
                  {continueWatching.length > 0 && (
                    <div className="w-full pb-4 border-b border-burgundy-900/30 text-left">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-lavender-200/50 mb-3 flex items-center gap-1.5 pl-1">
                        <Play className="h-3.5 w-3.5 text-maroon-500 fill-current" />
                        <span>Continue Watching</span>
                      </h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {continueWatching.map((item) => {
                          const remainingSec = item.duration - item.currentPosition;
                          const remainingMin = Math.ceil(remainingSec / 60);
                          return (
                            <div key={item.id} className="bg-burgundy-950/60 border border-burgundy-900/50 rounded-xl overflow-hidden hover:border-maroon-700/45 hover:shadow-lg transition-all group flex flex-col justify-between">
                              <div className="relative aspect-video bg-black flex-shrink-0">
                                {item.poster ? (
                                  <img src={item.poster} alt={item.movieTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-burgundy-950 text-lavender-450">
                                    <FileVideo className="h-8 w-8 opacity-30" />
                                  </div>
                                )}
                                {/* Play Overlay */}
                                <button
                                  type="button"
                                  onClick={() => handleResume(item)}
                                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer"
                                >
                                  <div className="h-9 w-9 flex items-center justify-center rounded-full bg-maroon-700 text-white shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-300">
                                    <Play className="h-4 w-4 fill-current ml-0.5" />
                                  </div>
                                </button>
                                
                                {/* Remove Button */}
                                <button
                                  type="button"
                                  onClick={(e) => removeContinueWatching(e, item.id)}
                                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white/70 hover:text-white hover:bg-maroon-600 opacity-0 group-hover:opacity-100 transition-all duration-300 z-10"
                                  title="Remove from list"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                                
                                {/* Progress Bar */}
                                <div className="absolute bottom-0 left-0 w-full h-1 bg-burgundy-900/60">
                                  <div className="bg-maroon-600 h-full" style={{ width: `${item.progressPercentage || 0}%` }}></div>
                                </div>
                              </div>
                              
                              <div className="p-3 flex-1 flex flex-col justify-between gap-1.5">
                                <div>
                                  <h3 className="text-xs font-bold text-lavender-100 truncate capitalize" title={item.movieTitle}>
                                    {item.movieTitle.replace(/[-._]/g, " ").replace(/\.(mp4|mkv|avi|webm|mov)$/i, "")}
                                  </h3>
                                  <p className="text-[9px] text-lavender-300/40 font-medium mt-0.5">
                                    Last watched: {new Date(item.timestamp).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="flex items-center justify-between mt-1 text-[10px] font-semibold">
                                  <span className="text-lavender-300/70">{remainingMin} min left</span>
                                  <button
                                    type="button"
                                    onClick={() => handleResume(item)}
                                    className="text-maroon-400 hover:text-maroon-355 flex items-center gap-0.5 cursor-pointer font-bold"
                                  >
                                    Resume
                                    <ChevronRight className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-lavender-200/40" />
                      <input
                        type="text"
                        placeholder="Search your movies..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-burgundy-950/80 border border-burgundy-900/60 rounded-xl text-white text-sm focus:outline-none focus:border-maroon-500 transition"
                      />
                    </div>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="px-4 py-2 bg-burgundy-950/80 border border-burgundy-900/60 rounded-xl text-white text-sm focus:outline-none focus:border-maroon-500 transition"
                    >
                      <option value="date">Latest First</option>
                      <option value="name">Alphabetical</option>
                      <option value="size">Largest First</option>
                    </select>
                  </div>

                  {loadingLibrary ? (
                    <div className="text-center py-8 text-lavender-200/60">Loading library...</div>
                  ) : filteredLibrary.length === 0 ? (
                    <div className="text-center py-10 bg-burgundy-950/30 rounded-xl border border-burgundy-900/30">
                      <FileVideo className="h-10 w-10 text-lavender-400/30 mx-auto mb-3" />
                      <p className="text-lavender-200/60 text-sm font-semibold mb-1">Your library is empty.</p>
                      <button onClick={() => setStreamMode("upload")} className="mt-3 text-maroon-400 hover:text-maroon-300 text-xs font-bold underline underline-offset-2">Upload your first movie!</button>
                    </div>
                  ) : (
                    <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {filteredLibrary.map(movie => (
                        <div key={movie.id} className="flex items-center gap-3 p-3 bg-burgundy-950/60 hover:bg-burgundy-900/40 border border-burgundy-900/50 rounded-xl transition-all group">
                          <div className="h-10 w-10 flex-shrink-0 flex items-center justify-center rounded-lg bg-maroon-900/30 border border-maroon-700/30 text-lavender-300 relative overflow-hidden">
                            {movie.status === "processing" ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <FileVideo className="h-5 w-5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-lavender-100 truncate" title={movie.movieName}>{movie.movieName}</p>
                            <div className="flex gap-2 text-[10px] font-medium text-lavender-200/50 mt-0.5 items-center">
                              <span>{formatBytes(movie.size)}</span>
                              <span>•</span>
                              <span>{new Date(movie.uploadedAt).toLocaleDateString()}</span>
                              {movie.status === "processing" && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-400 font-semibold animate-pulse">Processing metadata...</span>
                                </>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button onClick={() => renameLibraryMovie(movie.id, movie.movieName)} className="p-1.5 text-lavender-200/50 hover:text-white bg-burgundy-950 hover:bg-maroon-700 rounded-lg transition-colors" title="Rename Title (File intact)">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => deleteLibraryMovie(movie.id, false)} className="p-1.5 text-lavender-200/50 hover:text-orange-400 bg-burgundy-950 hover:bg-orange-900/30 rounded-lg transition-colors" title="Remove from Library">
                              <FolderMinus className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => deleteLibraryMovie(movie.id, true)} className="p-1.5 text-lavender-200/50 hover:text-red-400 bg-burgundy-950 hover:bg-red-900/30 rounded-lg transition-colors" title="Delete Permanently from Disk">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <button 
                            disabled={uploading}
                            onClick={() => hostLibraryMovie(movie.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-maroon-700 hover:bg-maroon-600 text-white text-xs font-bold rounded-lg transition-colors shadow-md disabled:opacity-50 flex-shrink-0"
                          >
                            <PlayCircle className="h-4 w-4" />
                            <span className="hidden sm:inline">Host</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* FILE UPLOAD MODE */}
              {streamMode === "upload" && (
                <>
                  {!selectedFile && !uploaded && (
                    <div
                      className="group relative border-2 border-dashed border-burgundy-900/60 hover:border-lavender-400/40 rounded-2xl p-8 text-center bg-burgundy-950/30 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                    >
                      <UploadCloud className="h-10 w-10 text-lavender-400/45 mb-3 group-hover:text-lavender-400 group-hover:scale-110 transition-all duration-300" />
                      <p className="text-sm font-semibold text-lavender-100">
                        Drag and drop your movie file here
                      </p>
                      <p className="text-xs font-light text-lavender-200/40 mt-1 mb-4">
                        High-performance chunked upload • Duplicates automatically rejected!
                      </p>

                      <label className="cursor-pointer rounded-xl bg-burgundy-950 hover:bg-burgundy-900 text-lavender-200 font-semibold px-4 py-2 border border-burgundy-900/60 text-xs transition duration-300">
                        Browse File
                        <input
                          type="file"
                          accept=".mp4,.mkv,.webm,.avi,.mov"
                          className="hidden"
                          onChange={(e) =>
                            onFileChange(e.target.files ? e.target.files[0] : null)
                          }
                        />
                      </label>
                    </div>
                  )}

                  {selectedFile && !uploaded && (
                    <div className="space-y-5 rounded-2xl bg-burgundy-950/40 border border-burgundy-900/40 p-5">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-maroon-900/25 border border-maroon-700/20 text-lavender-300">
                          <FileVideo className="h-5.5 w-5.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-lavender-100 truncate">
                            {selectedFile.name}
                          </p>
                          <p className="text-xs font-light text-lavender-200/50 mt-0.5">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        {!uploading && (
                          <button
                            type="button"
                            onClick={() => setSelectedFile(null)}
                            className="text-xs text-lavender-200/40 hover:text-lavender-200 transition-colors"
                          >
                            Change
                          </button>
                        )}
                      </div>

                      {!uploading && (
                        <button
                          type="button"
                          onClick={uploadMovieToLibrary}
                          className="w-full py-3.5 bg-gradient-to-r from-maroon-700 to-maroon-600 hover:from-maroon-600 hover:to-maroon-500 text-white font-bold rounded-xl transition duration-300 shadow-md"
                        >
                          Upload to My Library
                        </button>
                      )}

                      {uploading && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-xs font-semibold text-lavender-200/80">
                            <span>
                              {uploadProgress === 100 ? "Processing Metadata..." : "Uploading Movie..."}
                            </span>
                            <span>
                              {formatBytes(uploadLoaded)} / {formatBytes(uploadTotal)} ({uploadProgress}%)
                            </span>
                          </div>
                          <div className="w-full bg-burgundy-950 rounded-full h-2.5 overflow-hidden border border-burgundy-900/50">
                            <div
                              className="bg-gradient-to-r from-maroon-600 to-lavender-500 h-full rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* VIDEO URL MODE */}
              {streamMode === "url" && !uploaded && (
                <div className="space-y-4 rounded-2xl bg-burgundy-950/40 border border-burgundy-900/40 p-5">
                  <p className="text-xs font-semibold text-lavender-200/70 uppercase tracking-wider">
                    Paste Video URL or YouTube Link 🔗
                  </p>
                  <input
                    type="text"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://youtube.com/watch?v=... or https://example.com/movie.mp4"
                    className="w-full px-4 py-3 bg-burgundy-950/80 border border-burgundy-900/60 rounded-xl text-white text-sm focus:outline-none focus:border-maroon-500 transition"
                  />
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Movie Title (e.g. My Movie Night)"
                    className="w-full px-4 py-3 bg-burgundy-950/80 border border-burgundy-900/60 rounded-xl text-white text-sm focus:outline-none focus:border-maroon-500 transition"
                  />
                  {!uploading ? (
                    <button
                      type="button"
                      onClick={() => setSharedMovieUrl(videoUrl, customName || "Direct Video Stream")}
                      className="w-full py-3.5 bg-gradient-to-r from-maroon-700 to-maroon-600 hover:from-maroon-600 hover:to-maroon-500 text-white font-bold rounded-xl transition duration-300 shadow-lg"
                    >
                      Stream from URL 🚀
                    </button>
                  ) : (
                    <div className="text-center py-2 text-xs text-lavender-200/60 font-semibold">
                      Configuring stream...
                    </div>
                  )}
                </div>
              )}

              {/* COMMON UPLOADED STATE (ROOM PREPARED) */}
              {uploaded && (
                <div className="space-y-4 rounded-2xl bg-burgundy-950/40 border border-burgundy-900/40 p-5">
                  <div className="flex items-center gap-2.5 text-emerald-400 font-semibold bg-emerald-950/20 border border-emerald-500/20 rounded-xl px-4 py-3">
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                    <span className="text-sm">Room & Video prepared successfully!</span>
                  </div>

                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-maroon-700 to-maroon-600 hover:from-maroon-600 hover:to-maroon-500 text-white font-bold py-4 rounded-xl shadow-lg transition duration-300"
                    onClick={() => navigate(`/room/${roomCode}`)}
                  >
                    Enter Watch Room
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}