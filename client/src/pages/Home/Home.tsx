import { Link } from "react-router-dom";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="flex min-h-[85vh] items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-3xl text-center"
      >
        <h1 className="mb-6 text-6xl font-extrabold">
          Watch Movies
          <span className="text-red-500"> Together</span>
        </h1>

        <p className="mb-10 text-lg text-slate-400">
          Stream movies with friends from anywhere. Chat, pause, play,
          seek, and enjoy synchronized movie nights.
        </p>

        <div className="flex justify-center gap-6">
          <Link
            to="/host"
            className="rounded-xl bg-red-500 px-8 py-4 text-lg font-semibold transition hover:bg-red-600"
          >
            Host Movie
          </Link>

          <Link
            to="/join"
            className="rounded-xl border border-slate-600 px-8 py-4 text-lg transition hover:bg-slate-800"
          >
            Join Room
          </Link>
        </div>
      </motion.div>
    </div>
  );
}