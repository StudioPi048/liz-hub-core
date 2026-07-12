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
  Users,
  Contact,
  Building2,
  Briefcase,
  Wallet,
  Sparkles,
  FolderOpen,
  Bot,
  LogOut,
  Settings,
  Search,
  BellRing,
  Clock,
  Star,
  Zap,
  Library,
  BookOpen,
  GraduationCap,
  Package,
  CalendarDays,
  Users2,
  Network,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/agenda", label: "Agenda", icon: Calendar },
  { to: "/links", label: "Links", icon: Link2 },
  { to: "/textos", label: "Textos", icon: FileText },
  { to: "/arquivos", label: "Arquivos", icon: FolderOpen },
  { to: "/crm", label: "CRM", icon: Contact },
  { to: "/projetos", label: "Projetos", icon: Briefcase },
  { to: "/equipe", label: "Equipe", icon: Users },
  { to: "/institucional", label: "Institucional", icon: Building2 },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/prompts", label: "Prompts IA", icon: Bot },
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
  {
    to: "/acervo/$collection",
    params: { collection: "autores" },
    label: "Autores e Professores",
    icon: Users2,
  },
  {
    to: "/acervo/$collection",
    params: { collection: "conceitos" },
    label: "Conceitos e Metodologia",
    icon: Network,
  },
  {
    to: "/acervo/$collection",
    params: { collection: "faq" },
    label: "Perguntas Frequentes",
    icon: HelpCircle,
  },
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
          <div className="flex items-center gap-2 px-2 py-3">
            <div className="h-9 w-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <div className="font-semibold text-sidebar-foreground">LIZ HUB</div>
              <div className="text-xs text-sidebar-foreground/70">Instituto LIZ</div>
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
                  // Exact match for overview, prefix match for others to keep active state
                  const active =
                    n.to === "/acervo"
                      ? pathname === "/acervo"
                      : pathname.startsWith("/acervo/" + (n as any).params?.collection);
                  return (
                    <SidebarMenuItem key={n.label}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link to={n.to as any} params={(n as any).params}>
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
            <SidebarGroupLabel>Ações Rápidas</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <Search className="h-4 w-4" />
                    <span>Busca Global (Cmd+K)</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <BellRing className="h-4 w-4 text-orange-500" />
                    <span>Pendências</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <Clock className="h-4 w-4" />
                    <span>Recentes</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
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
              <div className="truncate opacity-70">{profile.roles?.join(", ") || "viewer"}</div>
            </div>
          )}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="bg-background">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border/50 bg-background/95 backdrop-blur px-4">
          <SidebarTrigger />
          <div className="flex-1 flex items-center">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-64 justify-start text-muted-foreground font-normal"
            >
              <Search className="mr-2 h-3.5 w-3.5" />
              Buscar no LIZ HUB...
            </Button>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 relative">
            <BellRing className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-orange-500" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 relative">
            <Zap className="h-4 w-4" />
          </Button>
        </header>
        <main className="p-4 md:p-8 max-w-[1600px] mx-auto w-full">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
