import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarFooter,
  SidebarInset,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Calendar,
  Link2,
  FileText,
  Contact,
  Sparkles,
  LogOut,
  Settings,
  HelpCircle,
  Search,
  BellRing,
  Library,
  BookOpen,
  GraduationCap,
  Package,
  CalendarDays,
  WalletCards,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABEL } from "@/lib/role-labels";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/agenda", label: "Agenda", icon: Calendar },
  { to: "/crm", label: "Clientes", icon: Contact },
  { to: "/faturamento", label: "Faturamento", icon: Receipt },
  { to: "/financeiro", label: "Financeiro", icon: WalletCards },
  { to: "/links", label: "Links", icon: Link2 },
] as const;

const acervoNav = [
  { to: "/acervo", label: "Visão Geral", icon: Library },
  { to: "/acervo/$collection", params: { collection: "livros" }, label: "Livros", icon: BookOpen },
  {
    to: "/acervo/$collection",
    params: { collection: "cursos" },
    label: "Cursos e Formações",
    icon: GraduationCap,
  },
  {
    to: "/acervo/$collection",
    params: { collection: "produtos" },
    label: "Produtos",
    icon: Package,
  },
  {
    to: "/acervo/$collection",
    params: { collection: "eventos" },
    label: "Eventos",
    icon: CalendarDays,
  },
  // {
  //   to: "/acervo/$collection",
  //   params: { collection: "autores" },
  //   label: "Autores e Professores",
  //   icon: Users2,
  // },
  // {
  //   to: "/acervo/$collection",
  //   params: { collection: "conceitos" },
  //   label: "Conceitos e Metodologia",
  //   icon: Network,
  // },
] as const;

const conteudoNav = [
  { to: "/textos", label: "Textos", icon: FileText },
  { to: "/curadoria", label: "Curadoria", icon: Sparkles },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: profile } = useQuery({
    queryKey: ["me-profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.user.id)
        .maybeSingle();
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id);
      return { ...p, email: u.user.email, roles: (roles || []).map((r) => r.role) };
    },
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    toast.success("Sessão encerrada");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-3 px-2 py-3">
            <div className="h-10 w-10 flex items-center justify-center">
              <img
                src="/liz-logo.png"
                alt="LIZ"
                className="h-full w-full object-contain drop-shadow-sm"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sidebar-foreground tracking-tight leading-none">
                LIZ HUB
              </span>
              <span className="text-[10px] text-sidebar-foreground/70 uppercase tracking-widest mt-1">
                Instituto
              </span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Operação</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map((n) => {
                  const Icon = n.icon;
                  const active = pathname === n.to || pathname.startsWith(n.to + "/");
                  return (
                    <SidebarMenuItem key={n.to}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link to={n.to}>
                          <Icon />
                          <span>{n.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Acervo</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {acervoNav.map((n) => {
                  const Icon = n.icon;
                  const collection = "params" in n ? n.params.collection : undefined;
                  // Exact match for overview, prefix match for others to keep active state
                  const active =
                    n.to === "/acervo"
                      ? pathname === "/acervo"
                      : pathname.startsWith("/acervo/" + collection);
                  return (
                    <SidebarMenuItem key={n.label}>
                      <SidebarMenuButton asChild isActive={active}>
                        {"params" in n ? (
                          <Link to={n.to} params={n.params}>
                            <Icon />
                            <span>{n.label}</span>
                          </Link>
                        ) : (
                          <Link to={n.to}>
                            <Icon />
                            <span>{n.label}</span>
                          </Link>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Conteúdo</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {conteudoNav.map((n) => {
                  const Icon = n.icon;
                  const active = pathname === n.to || pathname.startsWith(n.to + "/");
                  return (
                    <SidebarMenuItem key={n.to}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link to={n.to}>
                          <Icon />
                          <span>{n.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/ajuda">
                  <HelpCircle />
                  <span>Ajuda</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link to="/configuracoes">
                  <Settings />
                  <span>Configurações</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={signOut}>
                <LogOut />
                <span>Sair</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          {profile && (
            <div className="px-3 py-2 text-xs text-sidebar-foreground/80 border-t border-sidebar-border">
              <div className="truncate font-medium">{profile.full_name || profile.email}</div>
              <div className="truncate opacity-70">
                {profile.roles?.map((r) => ROLE_LABEL[r] ?? r).join(", ") || ROLE_LABEL.viewer}
              </div>
            </div>
          )}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="bg-bg-page overflow-hidden p-3 md:p-4 h-screen">
        <div className="bg-bg-canvas rounded-[18px] shadow-[0_4px_16px_rgba(30,27,46,0.08)] flex-1 overflow-auto flex flex-col h-full border border-border/30 relative">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border/40 bg-bg-canvas/80 backdrop-blur-xl px-6 transition-all duration-300 rounded-t-[18px]">
            <SidebarTrigger className="hover:bg-primary/5 transition-colors rounded-full" />
            <div className="flex-1 flex items-center min-w-0">
              <Button
                variant="outline"
                size="sm"
                disabled
                title="Busca global ainda não implementada nesta versão."
                className="h-9 w-40 sm:w-56 md:w-64 justify-start text-muted-foreground font-normal bg-background/50 border-border/50 shadow-sm rounded-full px-4 disabled:opacity-50"
              >
                <Search className="mr-2 h-4 w-4 opacity-70 shrink-0" />
                <span className="truncate">Buscar no LIZ HUB...</span>
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              disabled
              title="Notificações ainda não implementadas nesta versão."
              className="h-9 w-9 relative hover:bg-primary/5 rounded-full transition-colors disabled:opacity-50"
            >
              <BellRing className="h-4 w-4 text-foreground/80" />
            </Button>
          </header>
          <main className="p-6 md:p-10 max-w-[1600px] mx-auto w-full animate-in fade-in duration-500">
            {children}
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
