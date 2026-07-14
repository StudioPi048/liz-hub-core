import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  KNOWLEDGE_TYPES,
  knowledgeTypeLabels,
  type KnowledgeType,
} from "@/features/knowledge/model/knowledge-types";

interface Props {
  nodeId: string;
  slug: string;
  currentType: KnowledgeType;
  currentStatus: string;
  currentAuthority: string;
}

export function ItemCurationPanel({
  nodeId,
  slug,
  currentType,
  currentStatus,
  currentAuthority,
}: Props) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<KnowledgeType>(currentType);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["knowledge-node", slug] });
    queryClient.invalidateQueries({ queryKey: ["knowledge-collection"] });
  };

  const typeMutation = useMutation({
    mutationFn: async (newType: KnowledgeType) => {
      const { error } = await supabase
        .from("knowledge_nodes")
        .update({ type: newType })
        .eq("id", nodeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tipo atualizado");
      invalidate();
    },
    onError: (err: any) =>
      toast.error("Falha ao alterar tipo", { description: err?.message }),
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("knowledge_nodes")
        .update({ status: "approved", authority_level: "official" })
        .eq("id", nodeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item aprovado e publicado!");
      invalidate();
    },
    onError: (err: any) =>
      toast.error("Falha ao aprovar", { description: err?.message }),
  });

  const isApproved = currentStatus === "approved" && currentAuthority === "official";

  return (
    <div className="border rounded-lg p-5 bg-card space-y-4">
      <h3 className="font-semibold text-sm border-b pb-2">Curadoria</h3>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Tipo (categoria)</label>
        <Select
          value={type}
          onValueChange={(v) => {
            setType(v as KnowledgeType);
            typeMutation.mutate(v as KnowledgeType);
          }}
          disabled={typeMutation.isPending}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KNOWLEDGE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {knowledgeTypeLabels[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        onClick={() => approveMutation.mutate()}
        disabled={approveMutation.isPending || isApproved}
        className="w-full gap-2"
      >
        {approveMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        {isApproved ? "Publicado (Oficial)" : "Aprovar e Publicar"}
      </Button>
    </div>
  );
}
