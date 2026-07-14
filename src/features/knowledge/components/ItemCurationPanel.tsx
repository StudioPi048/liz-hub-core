import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckCircle2,
  Loader2,
  ChevronDown,
  Sparkles,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  COMMERCIAL_TYPES,
  commercialTypeLabels,
  type CommercialType,
} from "@/features/knowledge/model/knowledge-types";

interface BaseProps {
  nodeId: string;
  slug: string;
}

function useInvalidate(slug: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["knowledge-node", slug] });
    qc.invalidateQueries({ queryKey: ["knowledge-collection"] });
  };
}

/** Compact type picker rendered as a clickable badge/dropdown next to the title. */
export function InlineTypePicker({
  nodeId,
  slug,
  currentType,
}: BaseProps & { currentType: CommercialType }) {
  const invalidate = useInvalidate(slug);
  const [type, setType] = useState<CommercialType>(currentType);

  const mutation = useMutation({
    mutationFn: async (newType: CommercialType) => {
      const { error } = await supabase
        .from("knowledge_nodes")
        .update({ type: newType })
        .eq("id", nodeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoria atualizada");
      invalidate();
    },
    onError: (err: any) =>
      toast.error("Falha ao alterar tipo", { description: err?.message }),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={mutation.isPending}>
        <button
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium uppercase tracking-wide text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
          type="button"
        >
          {mutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : null}
          <span>{commercialTypeLabels[type] ?? type}</span>
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Alterar categoria</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {COMMERCIAL_TYPES.map((t) => (
          <DropdownMenuItem
            key={t}
            onSelect={() => {
              if (t === type) return;
              setType(t);
              mutation.mutate(t);
            }}
            className={t === type ? "bg-muted font-medium" : ""}
          >
            {commercialTypeLabels[t]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Prominent approve button + status card for the header area. */
export function CurationStatusCard({
  nodeId,
  slug,
  currentStatus,
  currentAuthority,
  version,
  updatedAt,
}: BaseProps & {
  currentStatus: string;
  currentAuthority: string;
  version: number;
  updatedAt: string;
}) {
  const invalidate = useInvalidate(slug);

  const approve = useMutation({
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

  const isApproved =
    currentStatus === "approved" && currentAuthority === "official";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Curadoria
        </span>
        <Badge
          variant={isApproved ? "default" : "secondary"}
          className="capitalize"
        >
          {currentStatus}
        </Badge>
        <Badge variant="outline" className="capitalize">
          {currentAuthority}
        </Badge>
        <Badge variant="outline" className="font-mono">
          v{version}
        </Badge>
        <span className="text-xs text-muted-foreground">
          · atualizado {new Date(updatedAt).toLocaleDateString("pt-BR")}
        </span>
      </div>

      <Button
        onClick={() => approve.mutate()}
        disabled={approve.isPending || isApproved}
        size="lg"
        className="gap-2 shadow-md sm:shrink-0"
      >
        {approve.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isApproved ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {isApproved ? "Publicado (Oficial)" : "Aprovar e Publicar"}
      </Button>
    </div>
  );
}

/** Legacy full panel kept for other surfaces (edit modal, etc). */
export function ItemCurationPanel({
  nodeId,
  slug,
  currentType,
  currentStatus,
  currentAuthority,
}: BaseProps & {
  currentType: CommercialType;
  currentStatus: string;
  currentAuthority: string;
}) {
  const invalidate = useInvalidate(slug);
  const [type, setType] = useState<CommercialType>(currentType);

  const typeMutation = useMutation({
    mutationFn: async (newType: CommercialType) => {
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

  const isApproved =
    currentStatus === "approved" && currentAuthority === "official";

  return (
    <div className="border rounded-lg p-5 bg-card space-y-4">
      <h3 className="font-semibold text-sm border-b pb-2">Curadoria</h3>
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Tipo (categoria)</label>
        <Select
          value={type}
          onValueChange={(v) => {
            setType(v as CommercialType);
            typeMutation.mutate(v as CommercialType);
          }}
          disabled={typeMutation.isPending}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMMERCIAL_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {commercialTypeLabels[t]}
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

/** Interactive sales-status toggle for product/course items. */
export function SalesStatusToggle({
  nodeId,
  slug,
  metadata,
}: BaseProps & { metadata: Record<string, any> }) {
  const invalidate = useInvalidate(slug);
  const [enabled, setEnabled] = useState<boolean>(metadata.sales_enabled === true);

  const mutation = useMutation({
    mutationFn: async (next: boolean) => {
      const nextMetadata = { ...(metadata || {}), sales_enabled: next };
      const { error } = await supabase
        .from("knowledge_nodes")
        .update({ metadata: nextMetadata })
        .eq("id", nodeId);
      if (error) throw error;
      return next;
    },
    onMutate: async (next) => {
      setEnabled(next);
    },
    onSuccess: () => {
      toast.success(enabled ? "Vendas abertas" : "Vendas fechadas");
      invalidate();
    },
    onError: (err: any, _next, _ctx) => {
      setEnabled((prev) => !prev);
      toast.error("Falha ao atualizar status de vendas", {
        description: err?.message,
      });
    },
  });

  return (
    <button
      type="button"
      onClick={() => mutation.mutate(!enabled)}
      disabled={mutation.isPending}
      className="inline-flex items-center gap-2 rounded-full border bg-card pl-3 pr-1 py-1 text-xs font-medium transition-colors hover:bg-muted/60 disabled:opacity-60"
    >
      <Store className="h-3.5 w-3.5 text-muted-foreground" />
      <span className={enabled ? "text-emerald-600" : "text-destructive"}>
        {enabled ? "Vendas Abertas" : "Vendas Fechadas"}
      </span>
      <Switch
        checked={enabled}
        disabled={mutation.isPending}
        aria-label="Alternar status de vendas"
        className="data-[state=checked]:bg-emerald-600 data-[state=unchecked]:bg-destructive"
      />
    </button>
  );
}
