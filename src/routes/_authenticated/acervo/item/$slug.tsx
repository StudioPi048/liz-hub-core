import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getKnowledgeNodeBySlug } from "@/features/knowledge/api/knowledge.server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Loader2, ImageIcon, Tag, ExternalLink } from "lucide-react";
import { parseMetadata } from "@/features/knowledge/model/knowledge-types";
import { AssetGallery } from "@/features/knowledge/components/AssetGallery";
import { AssetUploadModal } from "@/features/knowledge/components/AssetUploadModal";
import { HotmartEnrichPanel } from "@/features/knowledge/components/HotmartEnrichPanel";
import {
  CurationStatusCard,
  InlineTypePicker,
  SalesStatusToggle,
} from "@/features/knowledge/components/ItemCurationPanel";

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
  const assets = data.assets || [];
  const metadata = parseMetadata(node.type, node.metadata) as any;
  const coverUrl = metadata.coverUrl;

  return (
    <div className="animate-in fade-in duration-500 pb-24 space-y-8">
      {/* Top nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="gap-2 -ml-3">
          <Link to="/acervo">
            <ArrowLeft className="h-4 w-4" /> Voltar ao Acervo
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {node.source_uri && (
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a href={node.source_uri} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" /> Abrir Página de Vendas
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-2">
            <Edit className="h-4 w-4" /> Editar Rascunho
          </Button>
        </div>
      </div>

      {/* Curation status card (prominent) */}
      <CurationStatusCard
        nodeId={node.id}
        slug={node.slug}
        currentStatus={node.status}
        currentAuthority={node.authority_level}
        version={node.version}
        updatedAt={node.updated_at}
      />

      {/* Title header */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <InlineTypePicker
            nodeId={node.id}
            slug={node.slug}
            currentType={node.type}
          />
          <SalesStatusToggle
            nodeId={node.id}
            slug={node.slug}
            metadata={metadata}
          />
          {metadata.tags?.slice(0, 6).map((t: string) => (
            <Badge key={t} variant="secondary" className="font-normal gap-1">
              <Tag className="h-3 w-3" /> {t}
            </Badge>
          ))}
        </div>

        <div>
          <h1 className="text-3xl md:text-5xl font-editorial tracking-tight leading-tight">
            {node.title}
          </h1>
          {metadata.subtitle && (
            <h2 className="text-lg md:text-xl text-muted-foreground mt-3 font-editorial">
              {metadata.subtitle}
            </h2>
          )}
        </div>

        {node.summary && (
          <p className="text-base md:text-lg leading-relaxed text-foreground/85 max-w-3xl">
            {node.summary}
          </p>
        )}
      </header>

      {/* Two-column body */}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {/* Left: cover + side panels */}
        <aside className="space-y-6">
          {coverUrl ? (
            <div className="group relative overflow-hidden rounded-2xl border bg-muted shadow-sm aspect-[2/3]">
              <img
                src={coverUrl}
                alt={node.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                <AssetUploadModal nodeId={node.id} nodeType={node.type}>
                  <Button variant="secondary" size="sm">
                    Trocar Capa
                  </Button>
                </AssetUploadModal>
              </div>
            </div>
          ) : (
            <div className="flex aspect-[2/3] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-muted/20 p-6 text-center">
              <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Nenhuma capa cadastrada
              </p>
              <AssetUploadModal nodeId={node.id} nodeType={node.type} />
            </div>
          )}

          {(node.type === "product" || node.type === "course") && (
            <HotmartEnrichPanel
              productId={node.id}
              slug={node.slug}
              initialUrl={
                metadata.public_url || metadata.hotmart_url || ""
              }
            />
          )}

          <div className="space-y-3 rounded-2xl border bg-card p-5">
            <h3 className="border-b pb-2 text-sm font-semibold">
              Metadados Técnicos
            </h3>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Autoridade</dt>
                <dd className="font-medium capitalize">
                  {node.authority_level}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Versão</dt>
                <dd className="font-mono">v{node.version}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Atualizado</dt>
                <dd>
                  {new Date(node.updated_at).toLocaleDateString("pt-BR")}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Slug</dt>
                <dd className="truncate font-mono text-xs">{node.slug}</dd>
              </div>
            </dl>
          </div>
        </aside>

        {/* Right: content + relations */}
        <div className="space-y-10 min-w-0">
          {node.content && node.content !== node.summary && (
            <section className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap">{node.content}</div>
            </section>
          )}

          <section className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-editorial font-semibold">
                Ativos e Mídias (DAM)
              </h3>
              <AssetUploadModal nodeId={node.id} nodeType={node.type} />
            </div>
            <AssetGallery assets={assets} />
          </section>

          <section className="space-y-5">
            <h3 className="text-xl font-editorial font-semibold">
              Relacionamentos
            </h3>

            {relations.outgoing.length === 0 &&
            relations.incoming.length === 0 ? (
              <p className="text-sm italic text-muted-foreground">
                Nenhum relacionamento cadastrado para este item.
              </p>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2">
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
                          className="flex items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50"
                        >
                          <Badge
                            variant="outline"
                            className="w-24 shrink-0 justify-center text-[10px]"
                          >
                            {edge.relation_type}
                          </Badge>
                          <span className="truncate text-sm font-medium">
                            {edge.target.title}
                          </span>
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
                          className="flex items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50"
                        >
                          <Badge
                            variant="outline"
                            className="w-24 shrink-0 justify-center text-[10px]"
                          >
                            {edge.relation_type}
                          </Badge>
                          <span className="truncate text-sm font-medium">
                            {edge.source.title}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
