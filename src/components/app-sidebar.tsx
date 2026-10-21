"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Briefcase, Cable, Radar, Send, UserRound } from "lucide-react";
import { SHELL_COPY } from "@/components/shell/copy";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAppStatus } from "@/lib/use-app-status";

const MAIN = [
  { href: "/perfil", title: SHELL_COPY.nav.profile, icon: UserRound, count: null },
  { href: "/vagas", title: SHELL_COPY.nav.jobs, icon: Briefcase, count: "jobs" },
  { href: "/candidaturas", title: SHELL_COPY.nav.applications, icon: Send, count: "applications" },
] as const;

const CONFIG = [
  { href: "/config/fontes", title: SHELL_COPY.nav.sources, icon: Radar },
  { href: "/config/ia", title: SHELL_COPY.nav.ai, icon: Bot },
  { href: "/config/ajudante", title: SHELL_COPY.nav.bridge, icon: Cable },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const status = useAppStatus(5000);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/vagas">
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Briefcase className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{SHELL_COPY.brand}</span>
                  <span className="text-muted-foreground truncate text-xs">{SHELL_COPY.tagline}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{SHELL_COPY.groups.main}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {MAIN.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.title}>
                    <Link href={item.href} onClick={() => setOpenMobile(false)}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  {item.count && status ? (
                    <SidebarMenuBadge className="tabular-nums">{status.counts[item.count]}</SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>{SHELL_COPY.groups.config}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {CONFIG.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(item.href)} tooltip={item.title}>
                    <Link href={item.href} onClick={() => setOpenMobile(false)}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
