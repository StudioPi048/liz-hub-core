import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getKnowledgeNodeBySlug } from "@/features/knowledge/api/knowledge.server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  ImageIcon,
  Tag,
  ExternalLink,
  Download,
  AlertTriangle,
  Network,
} from "lucide-react";
import {
  parseMetadata,
  knowledgeTypeLabels,
  type KnowledgeType,
  type KnowledgeMetadataUnion,
  type CommercialType,
} from "@/features/knowledge/model/knowledge-types";
import { AssetGallery } from "@/features/knowledge/components/AssetGallery";
import { AssetUploadModal } from "@/features/knowledge/components/AssetUploadModal";
import { HotmartEnrichPanel } from "@/features/knowledge/components/HotmartEnrichPanel";
import {
  CurationStatusCard,
  InlineTypePicker,
  SalesStatusToggle,
} from "@/features/knowledge/components/ItemCurationPanel";
import { InlineTextEdit } from "@/features/knowledge/components/InlineTextEdit";

const RELATION_TYPE_LABELS: Record<string, string> = {
  related: "Relacionado",
  cites: "Cita",
  cited_by: "Citado por",
  part_of: "Parte de",
  contains: "Contém",
  authored_by: "Autoria",
  prerequisite: "Pré-requisito",
};

type RelatedNodeRef = { id: string; title: string; slug: string; type: string };
type KnowledgeEdge = {
  id: string;
  relation_type: string;
  status: string;
  target?: RelatedNodeRef;
  source?: RelatedNodeRef;
};

// `getKnowledgeNodeBySlug` acessa o Supabase via `as any` no servidor (select("*")
// dinâmico), então o retorno não carrega tipo gerado — descrevemos aqui os
// campos conforme a linha real de `knowledge_nodes` (ver types.ts). `slug` é
// tratado como sempre presente aqui porque este registro foi encontrado
// justamente pela busca por slug.
type NodeDetail = {
  id: string;
  title: string;
  slug: string;
  type: string;
  status: string;
  authority_level: string;
  version: number;
  updated_at: string;
  summary: string | null;
  content: string;
  source_uri: string | null;
  metadata: unknown;
};

// União "achatada" apenas para leitura de campos opcionais na UI — o objeto
// real sempre corresponde a um único subtipo de KnowledgeMetadataUnion.
type FlatMetadata = Partial<
  KnowledgeMetadataUnion & { subtitle: string; public_url: string; hotmart_url: string }
>;

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

  const node = data.node as NodeDetail;
  const relations = data.relations as {
    outgoing: KnowledgeEdge[];
    incoming: KnowledgeEdge[];
  };
  const assets = data.assets || [];
  const metadata = parseMetadata(node.type, node.metadata) as FlatMetadata;
  const coverUrl = metadata.coverUrl;
  const isContentIncomplete = !node.summary?.trim() || !node.content?.trim();
  const relatedItems = [
    ...relations.outgoing
      .filter((e) => e.target)
      .map((e) => ({
        node: e.target as RelatedNodeRef,
        relationType: e.relation_type,
        dir: "out" as const,
      })),
    ...relations.incoming
      .filter((e) => e.source)
      .map((e) => ({
        node: e.source as RelatedNodeRef,
        relationType: e.relation_type,
        dir: "in" as const,
      })),
  ];

  return (
    <div className="animate-in fade-in duration-500 pb-24 space-y-8">
      {/* Top nav */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="gap-2 -ml-3 hover:bg-muted/50 rounded-full px-4 transition-all duration-300"
        >
          <Link to="/acervo">
            <ArrowLeft className="h-4 w-4" /> Voltar ao Acervo
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          {node.source_uri && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-full border-border/50 shadow-sm hover:shadow-md transition-all duration-300"
              asChild
            >
              <a href={node.source_uri} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 text-muted-foreground" /> Abrir Página de Vendas
              </a>
            </Button>
          )}
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
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-full shadow-lg gap-2"
                  asChild
                >
                  <a href={coverUrl} download target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" /> Baixar Capa
                  </a>
                </Button>
                <AssetUploadModal nodeId={node.id} nodeType={node.type}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full bg-background/50 border-border/50 text-foreground"
                  >
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
              <p className="text-sm font-medium text-muted-foreground">Nenhuma capa cadastrada</p>
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
                currentType={node.type as CommercialType}
              />
              <SalesStatusToggle nodeId={node.id} slug={node.slug} metadata={metadata} />
              {isContentIncomplete && (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-[var(--semantic-pending-fg)]/30 bg-[var(--semantic-pending-bg)] text-[var(--semantic-pending-fg)] font-medium"
                >
                  <AlertTriangle className="h-3 w-3" /> Conteúdo incompleto
                </Badge>
              )}
              {metadata.tags?.slice(0, 6).map((t: string) => (
                <Badge
                  key={t}
                  variant="secondary"
                  className="font-medium bg-muted/50 text-muted-foreground hover:bg-muted transition-colors rounded-full px-3 gap-1.5"
                >
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

            {node.summary !== undefined && (
              <InlineTextEdit
                nodeId={node.id}
                slug={node.slug}
                field="summary"
                initialValue={node.summary ?? ""}
                className="text-lg md:text-xl leading-relaxed text-foreground/80 font-light"
              />
            )}
          </header>

          <section className="prose prose-sm md:prose-base dark:prose-invert max-w-none mt-8 border-t border-border/20 pt-8">
            <h3 className="text-xl font-editorial font-medium mb-4 text-muted-foreground">
              Conteúdo Completo
            </h3>
            <InlineTextEdit
              nodeId={node.id}
              slug={node.slug}
              field="content"
              initialValue={node.content}
            />
          </section>

          {(node.type === "product" || node.type === "course") && (
            <div className="max-w-md pt-4">
              <HotmartEnrichPanel
                productId={node.id}
                slug={node.slug}
                initialUrl={metadata.public_url || metadata.hotmart_url || node.source_uri || ""}
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

        <section className="space-y-6">
          <h3 className="text-2xl font-editorial font-semibold tracking-tight flex items-center gap-2">
            <Network className="h-5 w-5 text-muted-foreground" /> Conteúdo relacionado
          </h3>
          {relatedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border/50 bg-muted/10 p-5">
              Nenhuma relação registrada com outros itens do acervo ainda.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {relatedItems.map(({ node: related, relationType }, idx) => (
                <Link
                  key={`${related.id}-${idx}`}
                  to="/acervo/item/$slug"
                  params={{ slug: related.slug }}
                  className="block rounded-xl border border-border/40 bg-card/50 p-4 transition-colors hover:border-border hover:bg-card"
                >
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px]">
                      {knowledgeTypeLabels[related.type as KnowledgeType] ?? related.type}
                    </Badge>
                    <span>{RELATION_TYPE_LABELS[relationType] ?? relationType}</span>
                  </div>
                  <p className="mt-2 font-medium text-sm line-clamp-2">{related.title}</p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
