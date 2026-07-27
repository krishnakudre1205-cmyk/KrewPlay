import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function MainLayout() {
  return (
    <div className="relative min-h-screen bg-burgundy-950 text-lavender-50 overflow-hidden font-sans">
      {/* Decorative ambient background glows */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-maroon-900/15 blur-[120px] ambient-blur-1 z-0" />
      <div className="pointer-events-none absolute top-1/2 -right-40 h-[600px] w-[600px] rounded-full bg-lavender-600/10 blur-[150px] ambient-blur-2 z-0" />
      
      <div className="relative z-10 flex min-h-screen flex-col">
        <Navbar />

        <main className="flex-1 flex flex-col">
          <Outlet />
        </main>

        <Footer />
      </div>
    </div>
  );
}