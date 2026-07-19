import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  disconnectContaAzul,
  getContaAzulAuthUrl,
  getContaAzulStatus,
  listContaAzulCategories,
} from "@/lib/conta-azul.functions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  Building2,
  FileText,
  Loader2,
  Receipt,
  RefreshCcw,
  Send,
  Users,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({
  conta_azul_connected: z.string().optional(),
  conta_azul_error: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/financeiro")({
  validateSearch: searchSchema,
  component: FinanceiroPage,
});

type ContaAzulCategory = Record<string, unknown>;

function FinanceiroPage() {
  const search = useSearch({ from: "/_authenticated/financeiro" });
  const qc = useQueryClient();
  const getAuthUrl = useServerFn(getContaAzulAuthUrl);

  const status = useQuery({
    queryKey: ["conta-azul-status"],
    queryFn: () => getContaAzulStatus(),
  });

  const categories = useQuery({
    queryKey: ["conta-azul-categories"],
    queryFn: () => listContaAzulCategories(),
    enabled: status.data?.status === "connected",
  });

  useEffect(() => {
    if (search.conta_azul_connected) {
      toast.success("Conta Azul conectada");
      qc.invalidateQueries({ queryKey: ["conta-azul-status"] });
      qc.invalidateQueries({ queryKey: ["conta-azul-categories"] });
    }
    if (search.conta_azul_error) {
      toast.error("Erro ao conectar Conta Azul: " + search.conta_azul_error);
    }
  }, [search, qc]);

  const disconnect = useMutation({
    mutationFn: () => disconnectContaAzul(),
    onSuccess: () => {
      toast.success("Conta Azul desconectada");
      qc.invalidateQueries({ queryKey: ["conta-azul-status"] });
      qc.removeQueries({ queryKey: ["conta-azul-categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function connect() {
    try {
      const { url } = await getAuthUrl({ data: { origin: window.location.origin } });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao iniciar OAuth da Conta Azul");
    }
  }

  const isConnected = status.data?.status === "connected";
  const isAdmin = status.data?.isAdmin ?? false;
  const isSetupRequired = status.data?.status === "setup_required" || status.isError;
  const categoryRows = (categories.data?.categorias || []).filter(
    (c): c is ContaAzulCategory => typeof c === "object" && c !== null && !Array.isArray(c),
  );

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-editorial tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Rotinas financeiras, vendas, cobranças e fiscal com a Conta Azul como motor.
          </p>
        </div>
        <ConnectionBadge status={status.data?.status} isLoading={status.isLoading} />
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <WalletCards className="h-4 w-4" /> Conta Azul
              </CardTitle>
              <CardDescription>
                Conexão OAuth 2.0 do Instituto LIZ com a API da Conta Azul Pro.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={connect}
                disabled={status.isLoading || !isAdmin || isConnected || isSetupRequired}
              >
                {status.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Conectar Conta Azul
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => disconnect.mutate()}
                disabled={!isConnected || !isAdmin || disconnect.isPending}
              >
                {disconnect.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                Desconectar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {isSetupRequired && !status.isLoading ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Configuração da Conta Azul pendente</AlertTitle>
              <AlertDescription>
                {setupRequiredMessage(status.data?.reason, status.error)}
              </AlertDescription>
            </Alert>
          ) : null}

          {!isSetupRequired && !isAdmin && !status.isLoading ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Acesso administrativo necessário</AlertTitle>
              <AlertDescription>
                Apenas administradores podem conectar ou desconectar a Conta Azul.
              </AlertDescription>
            </Alert>
          ) : null}

          {status.data?.status === "needs_reconnect" ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Reconexão necessária</AlertTitle>
              <AlertDescription>
                A autorização da Conta Azul expirou ou foi revogada. Conecte novamente para renovar
                o acesso.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            <Metric label="Status" value={statusLabel(status.data?.status, status.isLoading)} />
            <Metric
              label="Conectada em"
              value={
                status.data?.status === "connected"
                  ? formatDateTime(status.data.connectedAt ?? null)
                  : "Sem conexão"
              }
            />
            <Metric
              label="Categorias financeiras"
              value={categories.isLoading ? "Carregando..." : String(categoryRows.length)}
            />
          </div>

          <Separator />

          <div className="grid gap-3 md:grid-cols-5">
            <ModulePill icon={Users} label="Clientes" state="Próximo" />
            <ModulePill icon={Receipt} label="Vendas" state="Próximo" />
            <ModulePill icon={RefreshCcw} label="Contratos" state="Próximo" />
            <ModulePill icon={Building2} label="Cobranças" state="Próximo" />
            <ModulePill icon={FileText} label="Fiscal" state="Próximo" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="text-base">Categorias financeiras</CardTitle>
            <CardDescription>Primeira chamada real: GET /v1/categorias.</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => categories.refetch()}
            disabled={!isConnected || categories.isFetching}
          >
            {categories.isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {status.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !isConnected ? (
            <div className="rounded-lg border border-dashed border-border/70 p-8 text-center">
              <p className="text-sm font-medium">Conta Azul não conectada</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Conecte a integração para carregar as categorias financeiras validadas pela API.
              </p>
            </div>
          ) : categories.isError ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Falha ao carregar categorias</AlertTitle>
              <AlertDescription>
                {categories.error instanceof Error
                  ? categories.error.message
                  : "Erro desconhecido ao chamar a Conta Azul."}
              </AlertDescription>
            </Alert>
          ) : (
            <CategoriesTable categories={categoryRows} isLoading={categories.isLoading} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConnectionBadge({ status, isLoading }: { status?: string; isLoading: boolean }) {
  if (isLoading) {
    return <Badge variant="secondary">Verificando</Badge>;
  }

  if (status === "setup_required") {
    return <Badge variant="destructive">Configuração pendente</Badge>;
  }

  if (status === "connected") {
    return <Badge>Conta Azul ativa</Badge>;
  }

  if (status === "needs_reconnect" || status === "temporarily_unavailable") {
    return <Badge variant="destructive">Atenção</Badge>;
  }

  return <Badge variant="secondary">Desconectada</Badge>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function ModulePill({
  icon: Icon,
  label,
  state,
}: {
  icon: typeof Users;
  label: string;
  state: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{label}</span>
      </span>
      <span className="text-[11px] text-muted-foreground">{state}</span>
    </div>
  );
}

function CategoriesTable({
  categories,
  isLoading,
}: {
  categories: ContaAzulCategory[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (categories.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma categoria retornada pela API.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Categoria</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Identificador</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.map((category, index) => (
          <TableRow key={String(category.id || category.uuid || index)}>
            <TableCell className="font-medium">{categoryLabel(category)}</TableCell>
            <TableCell>
              {String(category.tipo || category.type || category.natureza || "-")}
            </TableCell>
            <TableCell className="font-mono text-xs">
              {String(category.id || category.uuid || category.codigo || "-")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function categoryLabel(category: ContaAzulCategory): string {
  return String(
    category.nome ||
      category.name ||
      category.descricao ||
      category.description ||
      category.codigo ||
      "Categoria sem nome",
  );
}

function statusLabel(status: string | undefined, isLoading: boolean): string {
  if (isLoading) return "Verificando...";
  if (status === "setup_required") return "Configuração pendente";
  if (status === "connected") return "Conectada";
  if (status === "needs_reconnect") return "Reconectar";
  if (status === "temporarily_unavailable") return "Indisponível";
  return "Desconectada";
}

function setupRequiredMessage(reason: string | undefined, error: unknown): string {
  if (reason === "missing_database_migration") {
    return "A migration da Conta Azul ainda não foi aplicada no Supabase. Aplique a migration conta_azul_oauth_tokens para liberar a conexão.";
  }

  if (reason === "missing_environment") {
    return "Os secrets da Conta Azul ainda não estão configurados no ambiente Lovable.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Não foi possível verificar a integração. Confira as migrations e os secrets do ambiente.";
}

function formatDateTime(value: string | null): string {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
