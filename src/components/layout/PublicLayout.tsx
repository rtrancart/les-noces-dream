import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import { PrerenderProvider } from "@/contexts/PrerenderContext";

export default function PublicLayout() {
  return (
    <PrerenderProvider>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 pt-20">
          <Outlet />
        </main>
        <Footer />
      </div>
    </PrerenderProvider>
  );
}
