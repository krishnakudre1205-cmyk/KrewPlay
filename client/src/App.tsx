import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import MainLayout from "./components/layout/MainLayout";

import Home from "./pages/Home/Home";
import Host from "./pages/Host/Host";
import Join from "./pages/Join/Join";
import Room from "./pages/Room/Room";
import Login from "./pages/Login/Login";
import Account from "./pages/Account/Account";

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "rgba(31, 0, 11, 0.95)",
            color: "#e2d7ff",
            border: "1px solid rgba(142,102,255,0.15)",
            borderRadius: "16px",
            fontSize: "13px",
            padding: "10px 16px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            backdropFilter: "blur(10px)",
          },
          success: {
            iconTheme: {
              primary: "#8e66ff",
              secondary: "#1f000b",
            },
          },
          error: {
            iconTheme: {
              primary: "#f43f5e",
              secondary: "#1f000b",
            },
          },
        }}
      />
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/host" element={<Host />} />
          <Route path="/join" element={<Join />} />
          <Route path="/room/:id" element={<Room />} />
          <Route path="/login" element={<Login />} />
          <Route path="/account" element={<Account />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}