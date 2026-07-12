import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/curadoria")({
  component: CuradoriaPage,
});

function CuradoriaPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const limit = 10;

  const { data, isLoading, error } = useQuery({
    queryKey: ["knowledge-nodes", page, statusFilter],
    queryFn: async () => {
      let query = supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("knowledge_nodes" as any)
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { nodes: (data as any[]) || [], count: count || 0 };
    },
  });

  if (error) {
    return <div className="text-destructive p-4">Erro ao carregar a curadoria.</div>;
  }

  const totalPages = data ? Math.ceil(data.count / limit) : 0;

  return (
    <div className="space-y-6 max-w-6xl liz-archive-theme min-h-[calc(100vh-4rem)] p-4 rounded-md">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-editorial tracking-tight text-archive-fg">
            Curadoria Institucional
          </h1>
          <p className="text-sm text-archive-muted">
            Painel administrativo com permissão restrita.
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="bg-archive-surface border border-archive-border rounded px-3 py-1 text-sm text-archive-fg"
        >
          <option value="all">Todos os Status</option>
          <option value="draft">Rascunho (Draft)</option>
          <option value="in_review">Em Revisão (In Review)</option>
          <option value="approved">Aprovado (Approved)</option>
          <option value="archived">Arquivado (Archived)</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-archive-muted" />
        </div>
      ) : (
        <div className="grid gap-3">
          {data?.nodes.length === 0 && (
            <p className="text-archive-muted">Nenhum nó de conhecimento encontrado.</p>
          )}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {data?.nodes.map((node: any) => (
            <Card key={node.id} className="bg-archive-surface border-archive-border">
              <CardContent className="p-4 flex justify-between items-start gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="font-medium text-archive-fg truncate">{node.title}</div>
                  <div className="text-xs text-archive-muted truncate">
                    {node.source_uri} • {new Date(node.updated_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs uppercase">
                    {node.type}
                  </Badge>
                  <Badge variant={node.status === "approved" ? "default" : "secondary"}>
                    {node.status}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {node.authority_level}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <span className="text-sm text-archive-muted">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Próxima
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
