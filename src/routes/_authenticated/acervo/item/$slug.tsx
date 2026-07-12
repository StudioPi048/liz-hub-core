import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getKnowledgeNodeBySlug } from "@/features/knowledge/api/knowledge.server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Edit, Calendar, BookOpen, Clock, Tag } from "lucide-react";
import { KNOWLEDGE_TYPES, parseMetadata } from "@/features/knowledge/model/knowledge-types";

export const Route = createFileRoute("/_authenticated/acervo/item/$slug")({
  component: ItemPage,
});

function ItemPage() {
  const { slug } = Route.useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["knowledge-node", slug],
    queryFn: () => getKnowledgeNodeBySlug({ data: { slug } }),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data?.node) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-2xl font-bold">Registro não encontrado</h2>
        <p className="text-muted-foreground">
          O item que você tentou acessar não existe ou você não tem permissão.
        </p>
        <Button asChild variant="outline">
          <Link to="/acervo">Voltar ao Acervo</Link>
        </Button>
      </div>
    );
  }

  const node = data.node as any;
  const relations = data.relations;
  const metadata = parseMetadata(node.type, node.metadata) as any;
  const isBook = node.type === "book";
  const coverUrl = metadata.coverUrl;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="gap-2 -ml-3">
          <Link to="/acervo">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Edit className="h-4 w-4" /> Editar Rascunho
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Left Column: Image or Basic Info */}
        <div className="w-full md:w-1/3 space-y-6 shrink-0">
          {coverUrl ? (
            <div className="rounded-lg overflow-hidden border shadow-sm aspect-[2/3] bg-muted relative">
              <img src={coverUrl} alt={node.title} className="object-cover w-full h-full" />
            </div>
          ) : (
            <div className="rounded-lg border shadow-sm aspect-video md:aspect-square bg-muted/20 flex flex-col items-center justify-center p-6 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground">Capa não cadastrada</p>
              <Button variant="link" size="sm" className="mt-2">
                Adicionar Capa
              </Button>
            </div>
          )}

          <div className="space-y-4 border rounded-lg p-5 bg-card">
            <h3 className="font-semibold text-sm border-b pb-2">Metadados Técnicos</h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo</span>
                <Badge variant="outline" className="uppercase">
                  {node.type}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status Editorial</span>
                <Badge variant={node.status === "approved" ? "default" : "secondary"}>
                  {node.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Autoridade</span>
                <span className="font-medium capitalize">{node.authority_level}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Versão</span>
                <span className="font-mono">v{node.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Última Atualização</span>
                <span>{new Date(node.updated_at).toLocaleDateString("pt-BR")}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Content and Relations */}
        <div className="flex-1 space-y-8">
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              {metadata.tags?.map((t: string) => (
                <Badge key={t} variant="secondary" className="font-normal gap-1">
                  <Tag className="h-3 w-3" /> {t}
                </Badge>
              ))}
            </div>

            <h1 className="text-3xl md:text-4xl font-editorial tracking-tight">{node.title}</h1>
            {metadata.subtitle && (
              <h2 className="text-xl text-muted-foreground mt-2 font-editorial">
                {metadata.subtitle}
              </h2>
            )}

            <p className="text-lg mt-6 leading-relaxed text-foreground/90">{node.summary}</p>
          </div>

          {node.content && node.content !== node.summary && (
            <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none border-t pt-8">
              <div className="whitespace-pre-wrap">{node.content}</div>
            </div>
          )}

          <div className="border-t pt-8 space-y-6">
            <h3 className="text-xl font-editorial font-semibold">Relacionamentos</h3>

            {relations.outgoing.length === 0 && relations.incoming.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Nenhum relacionamento cadastrado para este item.
              </p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {relations.outgoing.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      Aponta para (Saída)
                    </h4>
                    <div className="flex flex-col gap-2">
                      {relations.outgoing.map((edge: any) => (
                        <Link
                          key={edge.id}
                          to="/acervo/item/$slug"
                          params={{ slug: edge.target.slug }}
                          className="flex items-center gap-3 p-3 border rounded-md hover:bg-muted/50 transition-colors"
                        >
                          <Badge
                            variant="outline"
                            className="text-[10px] w-24 justify-center shrink-0"
                          >
                            {edge.relation_type}
                          </Badge>
                          <span className="text-sm font-medium truncate">{edge.target.title}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {relations.incoming.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      Mencionado por (Entrada)
                    </h4>
                    <div className="flex flex-col gap-2">
                      {relations.incoming.map((edge: any) => (
                        <Link
                          key={edge.id}
                          to="/acervo/item/$slug"
                          params={{ slug: edge.source.slug }}
                          className="flex items-center gap-3 p-3 border rounded-md hover:bg-muted/50 transition-colors"
                        >
                          <Badge
                            variant="outline"
                            className="text-[10px] w-24 justify-center shrink-0"
                          >
                            {edge.relation_type}
                          </Badge>
                          <span className="text-sm font-medium truncate">{edge.source.title}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
