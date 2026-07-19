import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getGoogleStatus } from "@/lib/google-calendar.functions";
import { getContaAzulStatus } from "@/lib/conta-azul.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarCheck2,
  Loader2,
  Save,
  SlidersHorizontal,
  Building2,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const qc = useQueryClient();

  const me = useQuery({
    queryKey: ["me-cfg"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.user.id)
        .maybeSingle();
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      return {
        userId: u.user.id,
        email: u.user.email,
        profile: p,
        roles: (r || []).map((x) => x.role),
      };
    },
  });

  const googleStatus = useQuery({ queryKey: ["google-status"], queryFn: () => getGoogleStatus() });
  const contaAzulStatus = useQuery({
    queryKey: ["conta-azul-status"],
    queryFn: () => getContaAzulStatus(),
  });

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    whatsapp: "",
    role_title: "",
    bio: "",
  });

  useEffect(() => {
    if (me.data?.profile) {
      setForm({
        full_name: me.data.profile.full_name ?? "",
        phone: me.data.profile.phone ?? "",
        whatsapp: me.data.profile.whatsapp ?? "",
        role_title: me.data.profile.role_title ?? "",
        bio: me.data.profile.bio ?? "",
      });
    }
  }, [me.data]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!me.data?.userId) throw new Error("Sessão inválida.");
      const { error } = await supabase.from("profiles").upsert({ id: me.data.userId, ...form });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["me-cfg"] });
      qc.invalidateQueries({ queryKey: ["me-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-editorial tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Seu perfil, preferências e integrações.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>{me.data?.email ?? <Skeleton className="h-4 w-40" />}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {me.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1">
                {(me.data?.roles || []).length === 0 ? (
                  <span className="text-xs text-muted-foreground">Nenhuma função atribuída.</span>
                ) : (
                  (me.data?.roles || []).map((r) => (
                    <Badge key={r} variant="secondary">
                      {r}
                    </Badge>
                  ))
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="cfg-name">Nome completo</Label>
                  <Input
                    id="cfg-name"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="cfg-role">Função / cargo</Label>
                  <Input
                    id="cfg-role"
                    value={form.role_title}
                    onChange={(e) => setForm({ ...form, role_title: e.target.value })}
                    placeholder="Ex: Terapeuta, Coordenação..."
                  />
                </div>
                <div>
                  <Label htmlFor="cfg-phone">Telefone</Label>
                  <Input
                    id="cfg-phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="cfg-whatsapp">WhatsApp</Label>
                  <Input
                    id="cfg-whatsapp"
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="cfg-bio">Biografia</Label>
                <Textarea
                  id="cfg-bio"
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  className="min-h-[90px]"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => saveProfile.mutate()}
                  disabled={saveProfile.isPending}
                >
                  {saveProfile.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar perfil
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarCheck2 className="h-4 w-4" /> Integrações
          </CardTitle>
          <CardDescription>Conexões ativas do Instituto com serviços externos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
            <div>
              <div className="text-sm font-medium">Google Calendar</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {googleStatus.isLoading
                  ? "Verificando conexão..."
                  : googleStatus.data?.status === "connected"
                    ? "Conectado — eventos sincronizados com a Agenda."
                    : "Não conectado."}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!googleStatus.isLoading && (
                <Badge
                  variant={googleStatus.data?.status === "connected" ? "default" : "secondary"}
                >
                  {googleStatus.data?.status === "connected" ? "Ativo" : "Inativo"}
                </Badge>
              )}
              <Button asChild variant="outline" size="sm">
                <Link to="/agenda">Gerenciar na Agenda</Link>
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <WalletCards className="h-4 w-4" /> Conta Azul
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {contaAzulStatus.isLoading
                  ? "Verificando conexão..."
                  : contaAzulStatus.data?.status === "connected"
                    ? "Conectada ao motor financeiro e fiscal do LIZ HUB."
                    : contaAzulStatus.data?.status === "setup_required"
                      ? "Configuração pendente no ambiente."
                      : "Não conectada."}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!contaAzulStatus.isLoading && (
                <Badge
                  variant={contaAzulStatus.data?.status === "connected" ? "default" : "secondary"}
                >
                  {contaAzulStatus.data?.status === "connected"
                    ? "Ativo"
                    : contaAzulStatus.data?.status === "setup_required"
                      ? "Pendente"
                      : "Inativo"}
                </Badge>
              )}
              <Button asChild variant="outline" size="sm">
                <Link to="/financeiro">Gerenciar</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="h-4 w-4" /> Preferências
          </CardTitle>
          <CardDescription>Notificações, fuso horário e idioma.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Preferências personalizadas ainda não estão disponíveis nesta versão do LIZ HUB. Por
            enquanto, todos os horários seguem o fuso de São Paulo (America/Sao_Paulo).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" /> Dados Institucionais
          </CardTitle>
          <CardDescription>Missão, valores, identidade de marca do Instituto LIZ.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Este conteúdo é mantido na{" "}
            <Link to="/institucional" className="text-primary underline underline-offset-2">
              Biblioteca Institucional
            </Link>
            , ainda em construção.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
