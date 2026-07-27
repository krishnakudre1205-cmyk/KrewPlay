import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { User, Lock, Sparkles, LogIn, UserPlus, AlertCircle } from "lucide-react";
import { API_BASE_URL } from "../../config/api";

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }

    setError("");
    setLoading(true);

    const endpoint = `${API_BASE_URL}${isRegister ? "/auth/register" : "/auth/login"}`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      // Success
      localStorage.setItem("user", JSON.stringify(data.user));
      
      // Auto-fill participant nickname for host/join forms
      localStorage.setItem("nickname", data.user.username);
      
      navigate("/");
    } catch (err) {
      console.error(err);
      setError("Failed to communicate with server");
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
            {isRegister ? <UserPlus className="h-6 w-6" /> : <LogIn className="h-6 w-6" />}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-lavender-50">
            {isRegister ? "Join KrewPlay" : "Welcome Back"}
          </h1>
          <p className="text-sm font-light text-lavender-200/50 mt-2">
            {isRegister
              ? "Create a premium account to save your watch history."
              : "Sign in to access your synchronization dashboard."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Error Notification */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2.5 text-red-400 bg-red-950/30 border border-red-500/20 rounded-xl px-4 py-3 text-xs"
              >
                <AlertCircle className="h-4.5 w-4.5 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Username Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold tracking-wider text-lavender-200/70 uppercase pl-1">
              Username
            </label>
            <div className="relative flex items-center">
              <User className="absolute left-4 text-lavender-400/50 h-5 w-5 pointer-events-none" />
              <input
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-burgundy-950/60 border border-burgundy-900/60 focus:border-lavender-400/60 focus:ring-2 focus:ring-lavender-400/10 text-lavender-100 placeholder-lavender-200/30 outline-none transition-all duration-300 text-sm"
                placeholder="Enter username..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold tracking-wider text-lavender-200/70 uppercase pl-1">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-4 text-lavender-400/50 h-5 w-5 pointer-events-none" />
              <input
                type="password"
                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-burgundy-950/60 border border-burgundy-900/60 focus:border-lavender-400/60 focus:ring-2 focus:ring-lavender-400/10 text-lavender-100 placeholder-lavender-200/30 outline-none transition-all duration-300 text-sm"
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {/* Action button */}
          <button
            type="submit"
            disabled={loading}
            className="group w-full flex items-center justify-center gap-2 bg-gradient-to-r from-maroon-700 to-maroon-600 hover:from-maroon-600 hover:to-maroon-500 text-white font-bold py-4 rounded-2xl transition-all duration-300 hover:scale-[1.01] shadow-xl shadow-maroon-950/40 hover:shadow-maroon-850/20 disabled:opacity-50 disabled:cursor-not-allowed mt-4 cursor-pointer"
          >
            {loading ? (
              <span>Connecting...</span>
            ) : (
              <>
                <span>{isRegister ? "Sign Up" : "Sign In"}</span>
                <Sparkles className="h-4.5 w-4.5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-burgundy-900/40 pt-6">
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
              setUsername("");
              setPassword("");
            }}
            className="text-xs text-lavender-300 hover:text-lavender-100 font-semibold transition"
          >
            {isRegister
              ? "Already have an account? Sign In"
              : "Don't have an account? Sign Up"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}