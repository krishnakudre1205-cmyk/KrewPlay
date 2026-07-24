import { Link } from "react-router-dom";
import { Film } from "lucide-react";

export default function Navbar() {
  return (
    <nav className="w-full border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link
          to="/"
          className="flex items-center gap-2 text-2xl font-bold text-red-500"
        >
          <Film size={28} />
          KK Cine
        </Link>

        <div className="flex items-center gap-4">
          <Link
            to="/host"
            className="rounded-lg bg-red-500 px-4 py-2 font-medium text-white transition hover:bg-red-600"
          >
            Host
          </Link>

          <Link
            to="/join"
            className="rounded-lg border border-slate-700 px-4 py-2 transition hover:bg-slate-800"
          >
            Join
          </Link>
        </div>
      </div>
    </nav>
  );
}