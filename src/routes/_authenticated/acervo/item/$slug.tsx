import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getKnowledgeNodeBySlug } from "@/features/knowledge/api/knowledge.server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit, Loader2, ImageIcon, Tag, ExternalLink, Download } from "lucide-react";
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
        <Button variant="ghost" size="sm" asChild className="gap-2 -ml-3 hover:bg-muted/50 rounded-full px-4 transition-all duration-300">
          <Link to="/acervo">
            <ArrowLeft className="h-4 w-4" /> Voltar ao Acervo
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          {node.source_uri && (
            <Button variant="outline" size="sm" className="gap-2 rounded-full border-border/50 shadow-sm hover:shadow-md transition-all duration-300" asChild>
              <a href={node.source_uri} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 text-muted-foreground" /> Abrir Página de Vendas
              </a>
            </Button>
          )}
          <Button variant="secondary" size="sm" className="gap-2 rounded-full shadow-sm hover:shadow-md transition-all duration-300 bg-secondary/80 hover:bg-secondary">
            <Edit className="h-4 w-4 text-muted-foreground" /> Editar Rascunho
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

      {/* Hero section (Cover left, Details right) */}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] items-start">
        
        {/* Left: Cover */}
        <aside className="w-full">
          {coverUrl ? (
            <div className="group relative overflow-hidden rounded-2xl bg-transparent aspect-[2/3] w-full border border-border/20 shadow-sm transition-all hover:shadow-md">
              <img
                src={coverUrl}
                alt={node.title}
                className="h-full w-full object-contain transition-all duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 opacity-0 backdrop-blur-[2px] transition-all duration-300 group-hover:opacity-100">
                <Button variant="secondary" size="sm" className="rounded-full shadow-lg gap-2" asChild>
                  <a href={coverUrl} download target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" /> Baixar Capa
                  </a>
                </Button>
                <AssetUploadModal nodeId={node.id} nodeType={node.type}>
                  <Button variant="outline" size="sm" className="rounded-full bg-background/50 border-border/50 text-foreground">
                    Trocar Capa
                  </Button>
                </AssetUploadModal>
              </div>
            </div>
          ) : (
            <div className="flex aspect-[2/3] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/60 bg-muted/10 p-6 text-center transition-colors hover:bg-muted/20 hover:border-border">
              <div className="rounded-full bg-muted/50 p-4">
                <ImageIcon className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Nenhuma capa cadastrada
              </p>
              <AssetUploadModal nodeId={node.id} nodeType={node.type} />
            </div>
          )}
        </aside>

        {/* Right: Title, Metadata, Enrich, Content */}
        <div className="space-y-8 min-w-0">
          <header className="space-y-6">
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
                <Badge key={t} variant="secondary" className="font-medium bg-muted/50 text-muted-foreground hover:bg-muted transition-colors rounded-full px-3 gap-1.5">
                  <Tag className="h-3 w-3 opacity-60" /> {t}
                </Badge>
              ))}
            </div>

            <div className="max-w-4xl">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-editorial tracking-tight leading-[1.1] text-foreground">
                {node.title}
              </h1>
              {metadata.subtitle && (
                <h2 className="text-xl md:text-2xl text-muted-foreground mt-4 font-editorial leading-snug">
                  {metadata.subtitle}
                </h2>
              )}
            </div>

            {node.summary && (
              <p className="text-lg md:text-xl leading-relaxed text-foreground/80 font-light">
                {node.summary}
              </p>
            )}
          </header>

          {node.content && node.content !== node.summary && (
            <section className="prose prose-sm md:prose-base dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap">{node.content}</div>
            </section>
          )}

          {(node.type === "product" || node.type === "course") && (
            <div className="max-w-md pt-4">
              <HotmartEnrichPanel
                productId={node.id}
                slug={node.slug}
                initialUrl={
                  metadata.public_url || metadata.hotmart_url || ""
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* Full-width body below */}
      <div className="space-y-10 border-t border-border/40 pt-10 mt-10">
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-editorial font-semibold tracking-tight">
              Ativos e Mídias (DAM)
            </h3>
            <AssetUploadModal nodeId={node.id} nodeType={node.type} />
          </div>
          <div className="rounded-2xl border border-border/40 bg-card/40 p-1">
            <AssetGallery assets={assets} />
          </div>
        </section>
      </div>
    </div>
  );
}
