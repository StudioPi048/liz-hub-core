import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wand2, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  productId: string;
  slug: string;
  initialUrl?: string;
}

export function HotmartEnrichPanel({ productId, slug, initialUrl }: Props) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [hasEnriched, setHasEnriched] = useState(!!initialUrl);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmed = url.trim();
      if (!trimmed) throw new Error("Informe a URL pública da Hotmart");
      const { data, error } = await supabase.functions.invoke("scrape-hotmart-url", {
        body: { productId, url: trimmed },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast.success("Dados puxados com sucesso!", {
        description: "Capa e descrição foram atualizadas.",
      });
      setHasEnriched(true);
      queryClient.invalidateQueries({ queryKey: ["knowledge-node", slug] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-collection"] });
    },
    onError: (err: any) => {
      toast.error("Falha no enriquecimento", {
        description: err?.message ?? "Erro desconhecido",
      });
    },
  });

  const handleCopy = () => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copiado para a área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border rounded-2xl p-5 bg-card/60 backdrop-blur-sm border-border/40 shadow-sm space-y-4">
      <div>
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-primary" /> Enriquecimento Rápido
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Cole a URL pública do produto na Hotmart para importar capa e descrição automaticamente.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Input
          type="url"
          placeholder="https://hotmart.com/pt-br/marketplace/..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={mutation.isPending}
          className="bg-background/50"
        />
        <div className="flex items-center gap-2">
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !url.trim()}
            className="gap-2 flex-1 shadow-sm transition-all hover:-translate-y-0.5"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Puxando...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" /> Puxar Dados Mágicos
              </>
            )}
          </Button>

          {url && (
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              className="shrink-0 transition-all border-border/50 bg-background/50"
              title="Copiar Link da Hotmart"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
