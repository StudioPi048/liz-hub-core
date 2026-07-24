import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAssetSignedUrl } from "../api/knowledge.server";
import type { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  FileArchive,
  Play,
  Download,
  Eye,
} from "lucide-react";
import { ASSET_CATEGORY_LABEL, ASSET_STATUS_LABEL, VISIBILITY_LABEL } from "../model/labels";

type KnowledgeAsset = Tables<"knowledge_assets"> & {
  revisions?: { status: string }[];
};

interface AssetGalleryProps {
  assets: KnowledgeAsset[];
}

const ASSET_TYPE_ICONS: Record<string, ReactNode> = {
  document: <FileText className="h-10 w-10 text-muted-foreground" />,
  image: <ImageIcon className="h-10 w-10 text-muted-foreground" />,
  video: <Play className="h-10 w-10 text-muted-foreground" />,
  archive: <FileArchive className="h-10 w-10 text-muted-foreground" />,
  link: <LinkIcon className="h-10 w-10 text-muted-foreground" />,
};

/** Resolve a URL utilizável para o ativo: signed URL do Supabase Storage ou URL externa direta. */
function useAssetUrl(asset: KnowledgeAsset) {
  const isSupabase = asset.storage_provider === "supabase";

  const { data, isLoading } = useQuery({
    queryKey: ["asset-url", asset.id],
    queryFn: () =>
      getAssetSignedUrl({
        data: { bucket: asset.storage_bucket ?? "", path: asset.storage_path ?? "" },
      }),
    enabled: isSupabase && !!asset.storage_bucket && !!asset.storage_path,
  });

  const url = isSupabase ? data?.signedUrl : asset.external_url;
  return { url: url ?? null, isLoading: isSupabase && isLoading };
}

function AssetPreview({
  asset,
  url,
  isLoading,
}: {
  asset: KnowledgeAsset;
  url: string | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <div className="h-32 w-full bg-muted animate-pulse rounded-md" />;
  }

  if (asset.asset_type === "image" && url) {
    return (
      <div className="h-32 w-full bg-muted rounded-md overflow-hidden relative group">
        <img
          src={url}
          alt={asset.name}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
        />
      </div>
    );
  }

  return (
    <div className="h-32 w-full bg-muted/30 rounded-md flex items-center justify-center border border-dashed">
      {ASSET_TYPE_ICONS[asset.asset_type] || (
        <FileText className="h-10 w-10 text-muted-foreground" />
      )}
    </div>
  );
}

function AssetCard({ asset }: { asset: KnowledgeAsset }) {
  const { url, isLoading } = useAssetUrl(asset);
  const hasPendingRevision = (asset.revisions ?? []).some((r) => r.status === "proposed");

  return (
    <div className="border rounded-lg p-3 bg-card flex flex-col gap-3 relative">
      {hasPendingRevision && (
        <Badge variant="destructive" className="absolute -top-2 -right-2 z-10 shadow-sm">
          Revisão Pendente
        </Badge>
      )}

      <AssetPreview asset={asset} url={url} isLoading={isLoading} />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm truncate" title={asset.name}>
            {asset.name}
          </h4>
          {asset.is_primary && (
            <Badge variant="secondary" className="text-[10px] shrink-0">
              Principal
            </Badge>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-1 truncate">
          {ASSET_CATEGORY_LABEL[asset.asset_category as keyof typeof ASSET_CATEGORY_LABEL] ??
            asset.asset_category}{" "}
          • {asset.storage_provider}
        </p>

        <div className="flex items-center gap-2 mt-2">
          <Badge
            variant={asset.status === "approved" ? "default" : "outline"}
            className="text-[10px]"
          >
            {ASSET_STATUS_LABEL[asset.status as keyof typeof ASSET_STATUS_LABEL] ?? asset.status}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {VISIBILITY_LABEL[asset.visibility as keyof typeof VISIBILITY_LABEL] ??
              asset.visibility}
          </Badge>
        </div>
      </div>

      <div className="flex gap-2 mt-2 pt-2 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 h-8 text-xs gap-1"
          disabled={!url}
          title={url ? undefined : "Prévia indisponível para este ativo."}
          asChild={!!url}
        >
          {url ? (
            <a href={url} target="_blank" rel="noopener noreferrer">
              <Eye className="h-3 w-3" /> Visualizar
            </a>
          ) : (
            <>
              <Eye className="h-3 w-3" /> Visualizar
            </>
          )}
        </Button>
        {asset.storage_provider === "supabase" && (
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-8 text-xs gap-1"
            disabled={!url}
            title={url ? undefined : "Download indisponível para este ativo."}
            asChild={!!url}
          >
            {url ? (
              <a
                href={url}
                download={asset.original_filename ?? asset.name}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="h-3 w-3" /> Baixar
              </a>
            ) : (
              <>
                <Download className="h-3 w-3" /> Baixar
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export function AssetGallery({ assets }: AssetGalleryProps) {
  if (!assets || assets.length === 0) {
    return (
      <div className="text-center p-8 border rounded-lg border-dashed bg-muted/10">
        <p className="text-sm text-muted-foreground">Nenhum ativo associado a este registro.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {assets.map((asset) => (
        <AssetCard key={asset.id} asset={asset} />
      ))}
    </div>
  );
}
