import { Sidebar } from "@/components/nav/Sidebar";
import { BottomNav } from "@/components/nav/BottomNav";

/**
 * Shell for every authenticated screen: fixed sidebar on desktop, bottom nav on
 * mobile. The route guard lives in middleware.ts; this layout only lays out the
 * chrome around the page content.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <Sidebar />
      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-content px-5 pb-28 pt-8 sm:px-8 lg:pb-14">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
