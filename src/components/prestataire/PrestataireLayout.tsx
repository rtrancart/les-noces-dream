import { Outlet } from "react-router-dom";
import { PrestataireSidebar } from "./PrestataireSidebar";
import Header from "@/components/layout/Header";

export default function PrestataireLayout() {
  return (
    <>
      <Header />
      <div className="pt-20">
        <div className="min-h-[calc(100vh-5rem)] flex w-full">
          <PrestataireSidebar />
          <main className="flex-1 overflow-auto bg-background p-6 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}
