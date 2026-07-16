import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  FileText,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  CheckSquare,
  Square,
  ChevronDown,
} from "lucide-react";
import { useState, useMemo } from "react";
import type { Json, Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/curadoria")({
  component: CuradoriaPage,
});

const CONCEPTS = [
  "Psicogenealogia",
  "Decodificação de Nomes",
  "Constelação Familiar",
  "Terapia Sistêmica",
  "Eventos Ao Vivo",
  "Mentoria",
  "Geral",
];

type CurationNode = Pick<
  Tables<"knowledge_nodes">,
  "id" | "title" | "status" | "authority_level" | "type" | "metadata" | "source_type"
>;

function CuradoriaPage() {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [selectedBulkConcept, setSelectedBulkConcept] = useState<string>("keep_existing");

  // Fetch up to 200 items to populate the board without pagination for now
  const { data, isLoading, error } = useQuery({
    queryKey: ["curadoria-board"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_nodes")
        .select("id, title, status, authority_level, type, metadata, source_type")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      return data || [];
    },
  });

  const columns = useMemo(() => {
    const nodes = data || [];
    return {
      draft: nodes.filter((n) => n.status === "draft"),
      in_review: nodes.filter((n) => n.status === "in_review"),
      approved: nodes.filter((n) => n.status === "approved"),
    };
  }, [data]);

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAllInColumn = (status: string) => {
    const columnIds = (data || []).filter((n) => n.status === status).map((n) => n.id);
    const next = new Set(selectedIds);
    let allSelected = true;
    for (const id of columnIds) {
      if (!next.has(id)) allSelected = false;
    }

    if (allSelected) {
      columnIds.forEach((id) => next.delete(id));
    } else {
      columnIds.forEach((id) => next.add(id));
    }
    setSelectedIds(next);
  };

  const bulkApproveMutation = useMutation({
    mutationFn: async ({ ids, concept }: { ids: string[]; concept: string }) => {
      // First, we need to get current metadata for these nodes if we are updating it
      const { data: currentNodes, error: fetchErr } = await supabase
        .from("knowledge_nodes")
        .select("id, metadata")
        .in("id", ids);

      if (fetchErr) throw fetchErr;

      const updates = currentNodes.map((node) => {
        const newMetadata: Record<string, Json> = {
          ...((node.metadata as Record<string, Json>) || {}),
        };
        if (concept !== "keep_existing") {
          newMetadata.primary_concept = concept;
        }

        return supabase
          .from("knowledge_nodes")
          .update({
            status: "approved",
            authority_level: "official",
            metadata: newMetadata,
          })
          .eq("id", node.id);
      });

      await Promise.all(updates);
    },
    onSuccess: () => {
      toast.success(`${selectedIds.size} itens aprovados com sucesso!`);
      setSelectedIds(new Set());
      setBulkModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["curadoria-board"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-collection"] });
    },
    onError: (err: Error) => {
      toast.error("Falha ao aprovar em massa", { description: err.message });
    },
  });

  const handleBulkApprove = () => {
    if (selectedIds.size === 0) return;
    bulkApproveMutation.mutate({
      ids: Array.from(selectedIds),
      concept: selectedBulkConcept,
    });
  };

  if (error) {
    return <div className="text-destructive p-4">Erro ao carregar a curadoria.</div>;
  }

  return (
    <div className="space-y-6 max-w-full min-h-[calc(100vh-4rem)] p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-editorial tracking-tight">Curadoria e Triagem</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mova os itens pelo funil de aprovação e enriqueça com metadados.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <KanbanColumn
            title="1. Rascunhos (Capturados)"
            count={columns.draft.length}
            nodes={columns.draft}
            selectedIds={selectedIds}
            onToggle={toggleSelection}
            onSelectAll={() => selectAllInColumn("draft")}
            badgeVariant="secondary"
          />
          <KanbanColumn
            title="2. Em Revisão (Enriquecidos)"
            count={columns.in_review.length}
            nodes={columns.in_review}
            selectedIds={selectedIds}
            onToggle={toggleSelection}
            onSelectAll={() => selectAllInColumn("in_review")}
            badgeVariant="outline"
          />
          <KanbanColumn
            title="3. Aprovados (Catálogo Oficial)"
            count={columns.approved.length}
            nodes={columns.approved}
            selectedIds={selectedIds}
            onToggle={toggleSelection}
            onSelectAll={() => selectAllInColumn("approved")}
            badgeVariant="default"
          />
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 sm:w-auto sm:max-w-none">
          <div className="bg-foreground text-background px-4 py-3 sm:px-6 sm:py-4 rounded-2xl sm:rounded-full shadow-2xl flex flex-wrap items-center justify-center gap-3 sm:gap-6">
            <span className="font-medium text-sm whitespace-nowrap">
              {selectedIds.size}{" "}
              {selectedIds.size === 1 ? "item selecionado" : "itens selecionados"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="rounded-full"
                onClick={() => setBulkModalOpen(true)}
              >
                <Sparkles className="h-4 w-4 mr-2" /> Aprovar e Publicar Todos
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full text-background hover:bg-background/20"
                onClick={() => setSelectedIds(new Set())}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Approve Modal */}
      <Dialog open={bulkModalOpen} onOpenChange={setBulkModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar {selectedIds.size} itens em lote</DialogTitle>
            <DialogDescription>
              Você está prestes a transformar todos esses itens em versões Oficiais no seu acervo.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Conceito Principal (Opcional)</label>
              <p className="text-xs text-muted-foreground">
                Se os itens selecionados pertencerem ao mesmo tema, defina-o aqui para facilitar a
                estruturação futura da taxonomia.
              </p>
              <Select value={selectedBulkConcept} onValueChange={setSelectedBulkConcept}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um conceito..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep_existing">Manter tags atuais (não alterar)</SelectItem>
                  {CONCEPTS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleBulkApprove} disabled={bulkApproveMutation.isPending}>
              {bulkApproveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Publicação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KanbanColumn({
  title,
  count,
  nodes,
  selectedIds,
  onToggle,
  onSelectAll,
  badgeVariant,
}: {
  title: string;
  count: number;
  nodes: CurationNode[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  badgeVariant: "default" | "secondary" | "outline";
}) {
  const queryClient = useQueryClient();

  return (
    <div className="flex flex-col bg-muted/30 rounded-xl p-4 border border-border/40 min-h-[60vh]">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-sm">{title}</h2>
          <Badge variant={badgeVariant} className="text-xs">
            {count}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSelectAll}
          className="h-8 px-2 text-xs text-muted-foreground"
        >
          Selecionar Tudo
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {nodes.map((node) => {
          const isSelected = selectedIds.has(node.id);
          const metadata = (node.metadata as Record<string, Json>) || {};
          const concept =
            typeof metadata.primary_concept === "string" ? metadata.primary_concept : undefined;

          return (
            <Card
              key={node.id}
              className={`transition-all duration-200 cursor-pointer border-border/50 hover:border-primary/40 ${isSelected ? "ring-2 ring-primary bg-primary/5" : "bg-card"}`}
              onClick={() => onToggle(node.id)}
            >
              <CardContent className="p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1 shrink-0">
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm leading-tight text-foreground line-clamp-2">
                      {node.title}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[10px] uppercase bg-background">
                        {node.type}
                      </Badge>
                      {concept && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-muted/80 text-muted-foreground"
                        >
                          {concept}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Inline concept picker for individual items - stops propagation so it doesn't toggle selection */}
                <div
                  className="border-t border-border/40 pt-3 mt-1 flex justify-between items-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Select
                    value={concept || ""}
                    onValueChange={async (val) => {
                      const newMeta = { ...metadata, primary_concept: val };
                      await supabase
                        .from("knowledge_nodes")
                        .update({ metadata: newMeta })
                        .eq("id", node.id);
                      toast.success("Conceito salvo");
                      queryClient.invalidateQueries({ queryKey: ["curadoria-board"] });
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs bg-transparent border-dashed w-auto min-w-[120px]">
                      <SelectValue placeholder="+ Add Conceito" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONCEPTS.map((c) => (
                        <SelectItem key={c} value={c} className="text-xs">
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {node.source_type === "hotmart" && (
                    <span className="text-[10px] text-orange-500 font-medium">Hotmart</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {nodes.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm border border-dashed rounded-lg border-border/60">
            Coluna vazia
          </div>
        )}
      </div>
    </div>
  );
}
