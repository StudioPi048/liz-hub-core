import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: () => {
    const me = useQuery({
      queryKey: ["me-cfg"],
      queryFn: async () => {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return null;
        const { data: p } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
        const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
        return { email: u.user.email, profile: p, roles: (r||[]).map(x=>x.role) };
      },
    });
    return (
      <div className="max-w-2xl space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-sm text-muted-foreground">Seu perfil e permissões.</p>
        </div>
        <Card>
          <CardHeader><CardTitle>Perfil</CardTitle><CardDescription>{me.data?.email}</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            <div><span className="text-sm text-muted-foreground">Nome:</span> {me.data?.profile?.full_name}</div>
            <div className="flex gap-1">
              {(me.data?.roles || []).map(r => <Badge key={r} variant="secondary">{r}</Badge>)}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  },
});
