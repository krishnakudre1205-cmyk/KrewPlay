import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function MainLayout() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />

      <main className="min-h-[85vh]">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}