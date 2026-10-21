import { AppSidebar } from "@/components/app-sidebar";
import { BridgeStatus } from "@/components/bridge-status";
import { PageTitle } from "@/components/shell/page-title";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="bg-background/80 sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
          <PageTitle />
          <div className="ml-auto flex items-center gap-2">
            <BridgeStatus className="hidden sm:inline-flex" />
            <ThemeToggle />
          </div>
        </header>
        <div className="animate-in fade-in slide-in-from-bottom-2 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 duration-300 md:p-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
