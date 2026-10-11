import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";
import { PluginOverlays } from "@/lib/plugins";

export function Layout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
      <PluginOverlays />
    </div>
  );
}
