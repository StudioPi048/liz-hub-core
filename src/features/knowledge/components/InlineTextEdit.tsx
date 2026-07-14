import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Edit2, Check, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  nodeId: string;
  slug: string;
  field: "summary" | "content";
  initialValue: string;
  className?: string;
}

export function InlineTextEdit({ nodeId, slug, field, initialValue, className }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue || "");
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (newValue: string) => {
      const { error } = await supabase
        .from("knowledge_nodes")
        .update({ [field]: newValue })
        .eq("id", nodeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Texto atualizado com sucesso");
      setIsEditing(false);
      qc.invalidateQueries({ queryKey: ["knowledge-node", slug] });
    },
    onError: (err: any) => {
      toast.error("Erro ao atualizar texto", { description: err.message });
    }
  });

  if (isEditing) {
    return (
      <div className={`space-y-2 relative group w-full ${className || ""}`}>
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-h-[150px] bg-background resize-y"
          autoFocus
        />
        <div className="flex gap-2">
          <Button 
            size="sm" 
            onClick={() => mutation.mutate(value)} 
            disabled={mutation.isPending}
            className="h-8 gap-1"
          >
            {mutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Salvar
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              setValue(initialValue || "");
              setIsEditing(false);
            }} 
            disabled={mutation.isPending}
            className="h-8 gap-1"
          >
            <X className="h-3 w-3" /> Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`group relative rounded-md -mx-3 px-3 py-2 hover:bg-muted/40 transition-colors cursor-pointer border border-transparent hover:border-border/40 ${className || ""}`} onClick={() => setIsEditing(true)}>
      <Button 
        variant="ghost" 
        size="icon" 
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 shadow-sm"
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
        title="Editar texto"
      >
        <Edit2 className="h-3 w-3 text-muted-foreground" />
      </Button>
      {value ? (
        <div className="whitespace-pre-wrap">{value}</div>
      ) : (
        <span className="text-muted-foreground italic">Clique para adicionar texto...</span>
      )}
    </div>
  );
}
