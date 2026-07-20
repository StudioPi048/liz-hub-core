import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createAssetUploadUrl, registerAsset } from "../api/knowledge.server";
import {
  AssetCategory,
  StorageProvider,
  RightsStatus,
  Visibility,
  NODE_CATEGORY_MAPPING,
} from "../model/asset-vocabulary";
import { ASSET_CATEGORY_LABEL } from "../model/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AssetUploadModalProps {
  nodeId: string;
  nodeType: string;
  children?: React.ReactNode;
}

export function AssetUploadModal({ nodeId, nodeType, children }: AssetUploadModalProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>("");
  const [name, setName] = useState<string>("");
  const queryClient = useQueryClient();

  const validCategories =
    NODE_CATEGORY_MAPPING[nodeType as keyof typeof NODE_CATEGORY_MAPPING] || [];

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file || !category || !name) throw new Error("Preencha os campos obrigatórios");

      // 1. Get Signed Upload URL
      const ext = file.name.split(".").pop();
      const stableId = crypto.randomUUID();
      const path = `${nodeType}s/${nodeId}/${stableId}.${ext}`;

      const { signedUrl } = await createAssetUploadUrl({
        data: { bucket: "knowledge-assets", path },
      });

      // 2. Upload file directly to Supabase Storage via signed URL
      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
      });

      if (!uploadRes.ok) {
        throw new Error("Falha no upload do arquivo para o storage");
      }

      // 3. Determine asset_type based on mime
      let assetType = "document";
      if (file.type.startsWith("image/")) assetType = "image";
      else if (file.type.startsWith("video/")) assetType = "video";
      else if (file.type.startsWith("audio/")) assetType = "audio";
      else if (file.name.endsWith(".zip") || file.name.endsWith(".rar")) assetType = "archive";

      // 4. Register in database
      const asset = await registerAsset({
        data: {
          knowledge_node_id: nodeId,
          stable_id: stableId,
          asset_type: assetType,
          asset_category: category,
          name: name,
          storage_provider: "supabase",
          storage_bucket: "knowledge-assets",
          storage_path: path,
        },
      });

      return asset;
    },
    onSuccess: () => {
      toast.success("Ativo salvo com sucesso!");
      setOpen(false);
      setFile(null);
      setCategory("");
      setName("");
      // Refetch the node to get new assets
      queryClient.invalidateQueries({ queryKey: ["knowledge-node"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao fazer upload");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    uploadMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="gap-2">
            <Upload className="h-4 w-4" /> Adicionar Arquivo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Novo Ativo Institucional</DialogTitle>
          <DialogDescription>
            Faça upload de um arquivo para o repositório seguro do LIZ HUB.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Arquivo</Label>
            <Input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              disabled={uploadMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label>Nome de Exibição</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Capa Oficial, E-book V1"
              disabled={uploadMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select
              value={category}
              onValueChange={setCategory}
              disabled={uploadMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria..." />
              </SelectTrigger>
              <SelectContent>
                {validCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {ASSET_CATEGORY_LABEL[cat] ?? cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={uploadMutation.isPending || !file || !category || !name}
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...
              </>
            ) : (
              "Salvar Ativo"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
