import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAssetSignedUrl } from "../api/knowledge.server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Image as ImageIcon, Link as LinkIcon, FileArchive, Play, Download, Eye } from "lucide-react";

interface AssetGalleryProps {
  assets: any[];
}

function AssetPreview({ asset }: { asset: any }) {
  const isSupabase = asset.storage_provider === "supabase";
  
  const { data, isLoading } = useQuery({
    queryKey: ["asset-url", asset.id],
    queryFn: () => getAssetSignedUrl({ 
      data: { bucket: asset.storage_bucket, path: asset.storage_path } 
    }),
    enabled: isSupabase && !!asset.storage_bucket && !!asset.storage_path,
  });

  const url = isSupabase ? data?.signedUrl : asset.external_url;

  if (isSupabase && isLoading) {
    return <div className="h-32 w-full bg-muted animate-pulse rounded-md" />;
  }

  if (asset.asset_type === "image" && url) {
    return (
      <div className="h-32 w-full bg-muted rounded-md overflow-hidden relative group">
        <img src={url} alt={asset.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
      </div>
    );
  }

  const icons = {
    document: <FileText className="h-10 w-10 text-muted-foreground" />,
    image: <ImageIcon className="h-10 w-10 text-muted-foreground" />,
    video: <Play className="h-10 w-10 text-muted-foreground" />,
    archive: <FileArchive className="h-10 w-10 text-muted-foreground" />,
    link: <LinkIcon className="h-10 w-10 text-muted-foreground" />,
  } as any;

  return (
    <div className="h-32 w-full bg-muted/30 rounded-md flex items-center justify-center border border-dashed">
      {icons[asset.asset_type] || <FileText className="h-10 w-10 text-muted-foreground" />}
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
        <div key={asset.id} className="border rounded-lg p-3 bg-card flex flex-col gap-3 relative">
          {asset.revisions?.length > 0 && asset.revisions.some((r: any) => r.status === 'proposed') && (
            <Badge variant="destructive" className="absolute -top-2 -right-2 z-10 shadow-sm">
              Revisão Pendente
            </Badge>
          )}
          
          <AssetPreview asset={asset} />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-medium text-sm truncate" title={asset.name}>
                {asset.name}
              </h4>
              {asset.is_primary && (
                <Badge variant="secondary" className="text-[10px] shrink-0">Principal</Badge>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {asset.asset_category} • {asset.storage_provider}
            </p>
            
            <div className="flex items-center gap-2 mt-2">
              <Badge variant={asset.status === "approved" ? "default" : "outline"} className="text-[10px]">
                {asset.status}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {asset.visibility}
              </Badge>
            </div>
          </div>
          
          <div className="flex gap-2 mt-2 pt-2 border-t">
            <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs gap-1">
              <Eye className="h-3 w-3" /> Visualizar
            </Button>
            {asset.storage_provider === 'supabase' && (
              <Button variant="ghost" size="sm" className="flex-1 h-8 text-xs gap-1">
                <Download className="h-3 w-3" /> Baixar
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
