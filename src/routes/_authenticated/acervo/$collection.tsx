import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getKnowledgeNodes } from "@/features/knowledge/api/knowledge.server";
import { syncHotmartCatalog } from "@/lib/hotmart-sync.functions";
import {
  getTypeFromSlug,
  knowledgeTypeLabels,
  KnowledgeType,
} from "@/features/knowledge/model/knowledge-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2, ArrowLeft, Filter, FileText, RefreshCw, Check, CircleDot, CircleSlash } from "lucide-react";
import { useState, useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/acervo/$collection")({
  component: CollectionPage,
});

function CollectionPage() {
  const { collection } = Route.useParams();
  const type = getTypeFromSlug(collection);
  const [salesFilter, setSalesFilter] = useState<"all" | "active" | "suspended">("all");

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);

  // If type is not mapped, show 404-like state
  if (!type) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold">Coleção não encontrada</h2>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/acervo">Voltar ao Acervo</Link>
        </Button>
      </div>
    );
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ["knowledge-collection", type, page, debouncedSearch],
    queryFn: () => getKnowledgeNodes({ data: { type, page, limit: 12, query: debouncedSearch } }),
  });

  const label = knowledgeTypeLabels[type];

  const filteredNodes = useMemo(() => {
    const nodes = data?.nodes ?? [];
    if (salesFilter === "all") return nodes;
    return nodes.filter((n: any) => {
      const enabled = n.metadata?.sales_enabled;
      return salesFilter === "active" ? enabled === true : enabled !== true;
    });
  }, [data?.nodes, salesFilter]);

  const filterActive = salesFilter !== "all";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/acervo">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-editorial tracking-tight">{label}</h1>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Buscar em ${label.toLowerCase()}...`}
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant={filterActive ? "default" : "outline"}
              className={cn("gap-2 relative", filterActive && "border-primary")}
            >
              <Filter className="h-4 w-4" /> Filtros
              {filterActive && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Status de Vendas (Hotmart)</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setSalesFilter("active")} className="gap-2">
              <CircleDot className="h-4 w-4 text-emerald-600" />
              Vendas Ativas
              {salesFilter === "active" && <Check className="h-4 w-4 ml-auto" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSalesFilter("suspended")} className="gap-2">
              <CircleSlash className="h-4 w-4 text-destructive" />
              Vendas Suspensas
              {salesFilter === "suspended" && <Check className="h-4 w-4 ml-auto" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setSalesFilter("all")}
              disabled={salesFilter === "all"}
            >
              Limpar Filtros (mostrar todos)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {(type === "product" || type === "course") && <HotmartSyncButton />}
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="p-4 text-destructive border border-destructive/20 rounded-md bg-destructive/5">
          Erro ao carregar registros.
        </div>
      ) : filteredNodes.length === 0 ? (
        <EmptyCollectionState type={type} label={label} hasSearch={debouncedSearch.length > 0 || filterActive} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {data?.nodes.map((node: any) => (
              <EntityCard key={node.id} node={node} type={type} />
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

function HotmartSyncButton() {
  const queryClient = useQueryClient();
  const syncFn = useServerFn(syncHotmartCatalog);
  const mutation = useMutation({
    mutationFn: () => syncFn(),
    onSuccess: (result: any) => {
      if (result?.error) {
        toast.error("Falha ao sincronizar", { description: result.error });
        return;
      }
      toast.success("Catálogo Hotmart sincronizado", {
        description: `${result.created} novos · ${result.updated} atualizados${result.failed ? ` · ${result.failed} falhas` : ""}`,
      });
      queryClient.invalidateQueries({ queryKey: ["knowledge-collection"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-stats"] });
    },
    onError: (err: any) => {
      toast.error("Falha ao sincronizar", { description: err?.message ?? "Erro desconhecido" });
    },
  });

  return (
    <Button
      variant="secondary"
      className="gap-2"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
    >
      {mutation.isPending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Sincronizando catálogo...
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4" />
          Sincronizar Hotmart
        </>
      )}
    </Button>
  );
}

function EmptyCollectionState({
  type,
  label,
  hasSearch,
}: {
  type: KnowledgeType;
  label: string;
  hasSearch: boolean;
}) {
  if (hasSearch) {
    return (
      <div className="p-12 text-center border rounded-lg bg-muted/20">
        <p className="text-muted-foreground">Nenhum resultado encontrado para a sua busca.</p>
      </div>
    );
  }

  return (
    <div className="p-12 text-center border rounded-lg bg-muted/20 flex flex-col items-center">
      <FileText className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
      <h3 className="text-lg font-medium">Nenhum registro em {label}</h3>
      <p className="text-muted-foreground mt-2 max-w-md">
        Nenhum {type === "person" || type === "author" ? "registro" : "item"} foi cadastrado ainda
        no banco operacional.
      </p>
      <div className="flex gap-3 mt-6">
        <Button>Cadastrar {label.replace(/s$/, "")}</Button>
        <Button variant="outline">Importar Dados</Button>
      </div>
    </div>
  );
}

function EntityCard({ node, type }: { node: any; type: KnowledgeType }) {
  const coverImage = node.coverUrl || node.metadata?.cover_image;
  const hasCover = !!coverImage;

  return (
    <Link to="/acervo/item/$slug" params={{ slug: node.slug }} className="block group">
      <Card className="h-full overflow-hidden hover:border-primary/50 transition-colors flex flex-col">
        {hasCover ? (
          <div className="aspect-video w-full bg-muted border-b overflow-hidden relative">
            <img
              src={coverImage}
              alt={node.title}
              className="object-cover w-full h-full opacity-90 group-hover:opacity-100 transition-opacity"
            />
          </div>
        ) : (
          <div className="h-20 w-full bg-muted/50 border-b flex items-center justify-center">
            <span className="text-xs text-muted-foreground uppercase tracking-widest">{type}</span>
          </div>
        )}
        <CardContent className="p-4 flex-1 flex flex-col">
          <div className="flex justify-between items-start gap-2 mb-2">
            <h3 className="font-semibold text-base line-clamp-2 leading-tight group-hover:text-primary transition-colors">
              {node.title}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">
            {node.summary || "Sem descrição disponível."}
          </p>
          <div className="flex items-center gap-2 mt-auto">
            <Badge
              variant={node.status === "approved" ? "default" : "secondary"}
              className="text-[10px] uppercase"
            >
              {node.status}
            </Badge>
            {node.authority_level === "official" && (
              <Badge
                variant="outline"
                className="text-[10px] border-blue-500/30 text-blue-600 bg-blue-50/50"
              >
                Oficial
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
