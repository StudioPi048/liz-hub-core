import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getKnowledgeNodes } from "@/features/knowledge/api/knowledge.server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, FileText, CheckCircle2 } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/acervo/pendentes")({
  component: PendentesPage,
});

// Mesma ressalva de `acervo/$collection.tsx`: a query usa `as any` no servidor,
// então tipamos aqui apenas os campos que este card consome.
type PendingNode = {
  id: string;
  title: string;
  slug: string;
  type: string;
  status: string;
  authority_level: string | null;
  summary: string | null;
};

function PendentesPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["knowledge-pendentes", page],
    queryFn: () => getKnowledgeNodes({ data: { status: "draft", page, limit: 20, type: "all" } }),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/acervo">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-editorial tracking-tight flex items-center gap-2">
            <CheckCircle2 className="h-6 w-6 text-primary" />
            Revisar Pendentes
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Nós do conhecimento em rascunho aguardando revisão editorial.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="p-4 text-destructive border border-destructive/20 rounded-md bg-destructive/5">
          Erro ao carregar pendentes.
        </div>
      ) : data?.nodes.length === 0 ? (
        <div className="p-12 text-center border rounded-lg bg-muted/20 flex flex-col items-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
          <h3 className="text-lg font-medium">Nenhum registro pendente</h3>
          <p className="text-muted-foreground mt-2 max-w-md">
            Todos os registros estão aprovados ou arquivados.
          </p>
        </div>
      ) : (
        <>
          <div className="text-sm text-muted-foreground">{data?.count} registro(s) em rascunho</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(data?.nodes as PendingNode[] | undefined)?.map((node) => (
              <Link
                key={node.id}
                to="/acervo/item/$slug"
                params={{ slug: node.slug }}
                className="block group"
              >
                <Card className="h-full hover:border-primary/50 transition-colors">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                        {node.title}
                      </h3>
                      <Badge variant="secondary" className="text-[10px] uppercase shrink-0">
                        {node.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {node.summary || "Sem descrição disponível."}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {node.status}
                      </Badge>
                      {node.authority_level && (
                        <span className="text-[10px] text-muted-foreground uppercase">
                          {node.authority_level}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {data && data.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <div className="flex items-center px-4 text-sm text-muted-foreground">
                Página {page} de {data.totalPages}
              </div>
              <Button
                variant="outline"
                disabled={page === data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
