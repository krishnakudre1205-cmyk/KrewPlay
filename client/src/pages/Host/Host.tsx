import { useState, useEffect, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";

import { socket } from "../../services/socket";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileVideo, CheckCircle2, ChevronRight, Copy, Check, User, Sparkles } from "lucide-react";
import { API_BASE_URL } from "../../config/api";

export default function Host() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  useEffect(() => {
    const session = localStorage.getItem("user");
    if (!session) {
      navigate("/login");
      return;
    }
    const userData = JSON.parse(session);
    setName(userData.username);
  }, [navigate]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadLoaded, setUploadLoaded] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [roomCreated, setRoomCreated] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [streamMode, setStreamMode] = useState<"file" | "url">("file");
  const [videoUrl, setVideoUrl] = useState("");
  const [customName, setCustomName] = useState("");

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
      alert("Please enter your name");
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
    } catch (err) {
      console.error(err);
      alert("Failed to create room");
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

  async function uploadMovie() {
    if (!selectedFile) {
      alert("Select a movie");
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      setUploadLoaded(0);
      setUploadTotal(selectedFile.size);

      const form = new FormData();
      form.append("movie", selectedFile);

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_BASE_URL}/movies/${roomCode}/upload`);

        xhr.upload.onprogress = (event) => {
          const totalSize = event.lengthComputable ? event.total : selectedFile.size;
          if (!totalSize) return;
          const loaded = event.loaded || 0;
          setUploadLoaded(loaded);
          setUploadTotal(totalSize);
          const percent = Math.min(100, Math.round((loaded * 100) / totalSize));
          setUploadProgress(percent);
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response);
          } else {
            reject(new Error("Upload failed with status " + xhr.status));
          }
        };

        xhr.onerror = () => reject(new Error("Upload failed due to network error"));
        xhr.send(form);
      });

      setUploadProgress(100);
      setUploadLoaded(selectedFile.size);
      setUploaded(true);
    } catch (err: any) {
      console.error(err);
      alert("Upload failed: " + (err.response?.data?.message || err.message || "Please try again"));
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

  function copyCode() {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-xl border border-burgundy-900/40 bg-gradient-to-b from-burgundy-900/35 to-burgundy-950/60 p-8 md:p-10 rounded-3xl backdrop-blur-md shadow-2xl shadow-black/60 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-lavender-500/20 to-transparent" />
        
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-maroon-700 to-burgundy-900 text-lavender-300 shadow-md mb-4 border border-maroon-600/30">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-lavender-50">
            {roomCreated ? "Upload Movie" : "Create Watch Room"}
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
              <div className="grid grid-cols-2 gap-2 bg-burgundy-950/60 p-1.5 rounded-xl border border-burgundy-900/40">
                <button
                  type="button"
                  onClick={() => { setStreamMode("file"); setUploaded(false); }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    streamMode === "file"
                      ? "bg-maroon-700 text-white shadow-md"
                      : "text-lavender-200/60 hover:text-white"
                  }`}
                >
                  📁 Upload File
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
                  🔗 Video URL
                </button>
              </div>

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

              {/* FILE UPLOAD MODE */}
              {streamMode === "file" && (
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
                        Supports .mp4, .mkv, .webm, .avi — Any file size supported!
                      </p>

                      <label className="cursor-pointer rounded-xl bg-burgundy-950 hover:bg-burgundy-900 text-lavender-200 font-semibold px-4 py-2 border border-burgundy-900/60 text-xs transition duration-300">
                        Browse File
                        <input
                          type="file"
                          accept=".mp4,.mkv,.webm,.avi"
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
                          onClick={uploadMovie}
                          className="w-full py-3.5 bg-gradient-to-r from-maroon-700 to-maroon-600 hover:from-maroon-600 hover:to-maroon-500 text-white font-bold rounded-xl transition duration-300"
                        >
                          Upload & Prepare Room
                        </button>
                      )}

                      {uploading && (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-xs font-semibold text-lavender-200/80">
                            <span>
                              {uploadProgress === 100 ? "Processing Movie..." : "Uploading Movie..."}
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

              {/* COMMON UPLOADED STATE (ALL MODES) */}
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