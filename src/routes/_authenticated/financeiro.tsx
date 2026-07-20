import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  disconnectContaAzul,
  executeContaAzulOperation,
  getContaAzulAuthUrl,
  getContaAzulBackofficeCatalog,
  getContaAzulStatus,
} from "@/lib/conta-azul.functions";
import {
  CATEGORIAS_DESPESA,
  criarContaPagar,
  editarContaPagar,
  excluirContaPagar,
  getContasPagar,
  marcarContaPaga,
  type ContaPagarRow,
} from "@/lib/financeiro.functions";
import { StatCard } from "@/components/StatCard";
import { SemanticBadge } from "@/components/SemanticBadge";
import type {
  ContaAzulBackofficeAction,
  ContaAzulBackofficeModule,
  ContaAzulJsonRecord,
  ContaAzulJsonValue,
  ContaAzulOperationResult,
} from "@/lib/conta-azul.server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  ArrowUpRight,
  Box,
  CalendarClock,
  Building2,
  CheckCircle2,
  ClipboardList,
  DatabaseZap,
  FileJson,
  FileText,
  Loader2,
  Pencil,
  PlugZap,
  Plus,
  Power,
  Receipt,
  RefreshCcw,
  Send,
  ShieldCheck,
  TerminalSquare,
  Trash2,
  Users,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";

type ContaAzulResultRow = { [key: string]: ContaAzulJsonValue };

const searchSchema = z.object({
  conta_azul_connected: z.string().optional(),
  conta_azul_error: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/financeiro")({
  validateSearch: searchSchema,
  component: FinanceiroPage,
});

function FinanceiroPage() {
  const search = useSearch({ from: "/_authenticated/financeiro" });
  const qc = useQueryClient();
  const getAuthUrl = useServerFn(getContaAzulAuthUrl);
  const executeOperation = useServerFn(executeContaAzulOperation);
  const [pendingAuthUrl, setPendingAuthUrl] = useState<string | null>(null);
  const [avancado, setAvancado] = useState(false);
  const [moduleId, setModuleId] = useState("financeiro");
  const [actionId, setActionId] = useState("");
  const [idValue, setIdValue] = useState("");
  const [queryText, setQueryText] = useState("{}");
  const [bodyText, setBodyText] = useState("{}");
  const [lastResult, setLastResult] = useState<ContaAzulOperationResult | null>(null);

  const status = useQuery({
    queryKey: ["conta-azul-status"],
    queryFn: () => getContaAzulStatus(),
  });

  const catalog = useQuery({
    queryKey: ["conta-azul-backoffice-catalog"],
    queryFn: () => getContaAzulBackofficeCatalog(),
    staleTime: 10 * 60 * 1000,
  });

  const modules = useMemo(() => catalog.data || [], [catalog.data]);
  const selectedModule = useMemo(
    () => modules.find((module) => module.id === moduleId) || modules[0],
    [moduleId, modules],
  );
  const selectedAction = useMemo(
    () => selectedModule?.actions.find((action) => action.id === actionId),
    [actionId, selectedModule],
  );

  useEffect(() => {
    if (search.conta_azul_connected) {
      toast.success("Conta Azul conectada");
      qc.invalidateQueries({ queryKey: ["conta-azul-status"] });
    }
    if (search.conta_azul_error) {
      toast.error("Erro ao conectar Conta Azul: " + search.conta_azul_error);
    }
  }, [search, qc]);

  useEffect(() => {
    if (!selectedModule) return;
    if (!selectedModule.actions.some((action) => action.id === actionId)) {
      setActionId(selectedModule.defaultActionId);
    }
  }, [actionId, selectedModule]);

  useEffect(() => {
    if (!selectedAction) return;
    setIdValue("");
    setQueryText(formatJson(selectedAction.queryTemplate || {}));
    setBodyText(formatJson(selectedAction.bodyTemplate || {}));
  }, [selectedAction]);

  const disconnect = useMutation({
    mutationFn: () => disconnectContaAzul(),
    onSuccess: () => {
      toast.success("Conta Azul desconectada");
      qc.invalidateQueries({ queryKey: ["conta-azul-status"] });
      setLastResult(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const operation = useMutation({
    mutationFn: async () => {
      if (!selectedModule || !selectedAction) {
        throw new Error("Selecione uma operação da Conta Azul.");
      }

      const result = await executeOperation({
        data: {
          moduleId: selectedModule.id,
          actionId: selectedAction.id,
          id: selectedAction.requiresId ? idValue.trim() : undefined,
          query: parseJsonRecord(queryText, "Filtros"),
          body: selectedAction.method === "GET" ? undefined : parseJsonValue(bodyText, "Payload"),
        },
      });

      return result;
    },
    onSuccess: (result) => {
      setLastResult(result);
      toast.success("Operação executada na Conta Azul");
      qc.invalidateQueries({ queryKey: ["conta-azul-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function connect() {
    let authWindow: Window | null = null;
    setPendingAuthUrl(null);
    try {
      authWindow = window.open("about:blank", "_blank");
      const result = await getAuthUrl({ data: { origin: window.location.origin } });
      if (!result.ok) {
        authWindow?.close();
        toast.error(result.message || setupRequiredMessage(result.reason, null));
        qc.invalidateQueries({ queryKey: ["conta-azul-status"] });
        return;
      }

      const opened = openContaAzulAuthUrl(result.url, authWindow);
      if (!opened) {
        setPendingAuthUrl(result.url);
        toast.info("Clique em Abrir autorização para continuar na Conta Azul.");
      }
    } catch (e) {
      authWindow?.close();
      toast.error(errorMessage(e));
    }
  }

  const isConnected = status.data?.status === "connected";
  const isAdmin = status.data?.isAdmin ?? false;
  const isSetupRequired = status.data?.status === "setup_required" || status.isError;
  const requiresAdmin = selectedAction
    ? selectedAction.method !== "GET" || selectedAction.dangerous
    : false;
  const canExecute =
    Boolean(selectedAction) &&
    isConnected &&
    !operation.isPending &&
    (!requiresAdmin || isAdmin) &&
    (!selectedAction?.requiresId || idValue.trim().length > 0);
  const operationCount = modules.reduce((total, module) => total + module.actions.length, 0);

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-editorial tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {avancado
              ? "Console técnico da Conta Azul. Use só se souber o que está fazendo."
              : "Despesas do Instituto: cadastre, acompanhe e marque como pagas."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ConnectionBadge status={status.data?.status} isLoading={status.isLoading} />
          <Button variant="ghost" size="sm" onClick={() => setAvancado((v) => !v)}>
            <TerminalSquare className="h-4 w-4" />
            {avancado ? "Voltar ao normal" : "Modo avançado"}
          </Button>
        </div>
      </div>

      {!avancado ? <ContasAPagarSecao /> : null}

      {!avancado ? null : (
        <>
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
                      <Power className="h-4 w-4" />
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
                  <ShieldCheck className="h-4 w-4" />
                  <AlertTitle>Acesso administrativo limitado</AlertTitle>
                  <AlertDescription>
                    Você pode consultar dados conectados. Criações, atualizações, baixas e exclusões
                    exigem perfil admin.
                  </AlertDescription>
                </Alert>
              ) : null}

              {status.data?.status === "needs_reconnect" ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Reconexão necessária</AlertTitle>
                  <AlertDescription>
                    A autorização da Conta Azul expirou ou foi revogada. Conecte novamente para
                    renovar o acesso.
                  </AlertDescription>
                </Alert>
              ) : null}

              {pendingAuthUrl ? (
                <Alert>
                  <Send className="h-4 w-4" />
                  <AlertTitle>Autorização pronta para abrir</AlertTitle>
                  <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      O preview do Lovable bloqueou o redirecionamento automático. Abra a
                      autorização da Conta Azul em uma nova aba.
                    </span>
                    <Button asChild size="sm" className="shrink-0">
                      <a href={pendingAuthUrl} target="_blank" rel="noreferrer">
                        Abrir autorização
                      </a>
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="grid gap-3 md:grid-cols-4">
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
                  label="Módulos operacionais"
                  value={catalog.isLoading ? "Carregando..." : String(modules.length)}
                />
                <Metric
                  label="Operações Conta Azul"
                  value={catalog.isLoading ? "Carregando..." : String(operationCount)}
                />
              </div>
            </CardContent>
          </Card>

          {catalog.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          ) : catalog.isError ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Falha ao carregar operações</AlertTitle>
              <AlertDescription>{errorMessage(catalog.error)}</AlertDescription>
            </Alert>
          ) : (
            <Tabs value={selectedModule?.id || moduleId} onValueChange={setModuleId}>
              <TabsList className="h-auto flex-wrap justify-start">
                {modules.map((module) => {
                  const Icon = moduleIcon(module.id);
                  return (
                    <TabsTrigger key={module.id} value={module.id} className="gap-2">
                      <Icon className="h-4 w-4" />
                      {module.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {modules.map((module) => (
                <TabsContent key={module.id} value={module.id} className="mt-4">
                  <BackofficePanel
                    module={module}
                    actionId={actionId}
                    onActionChange={setActionId}
                    action={selectedModule?.id === module.id ? selectedAction : undefined}
                    idValue={idValue}
                    onIdChange={setIdValue}
                    queryText={queryText}
                    onQueryTextChange={setQueryText}
                    bodyText={bodyText}
                    onBodyTextChange={setBodyText}
                    isConnected={isConnected}
                    isAdmin={isAdmin}
                    canExecute={canExecute}
                    isExecuting={operation.isPending}
                    onExecute={() => operation.mutate()}
                    lastResult={selectedModule?.id === module.id ? lastResult : null}
                  />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}

const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function dataBR(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function todayISOLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type FiltroPagar = "abertas" | "vencidas" | "pagas";

function categoriaRotulo(valor: string): string {
  return CATEGORIAS_DESPESA.find((c) => c.valor === valor)?.rotulo ?? valor;
}

function ContasAPagarSecao() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<FiltroPagar>("abertas");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editando, setEditando] = useState<ContaPagarRow | null>(null);

  const contasQuery = useQuery({
    queryKey: ["fin-contas-pagar"],
    queryFn: () => getContasPagar(),
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ["fin-contas-pagar"] });

  const pagar = useMutation({
    mutationFn: (input: { id: number; pago: boolean }) => marcarContaPaga({ data: input }),
    onSuccess: (res) => {
      if (res.ok) invalidar();
      else toast.error(res.message);
    },
    onError: () => toast.error("Não consegui atualizar a conta. Tente de novo."),
  });

  const excluir = useMutation({
    mutationFn: (id: number) => excluirContaPagar({ data: { id } }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success("Despesa excluída.");
        invalidar();
      } else toast.error(res.message);
    },
    onError: () => toast.error("Não consegui excluir a despesa. Tente de novo."),
  });

  if (contasQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (contasQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Não consegui buscar as contas a pagar</AlertTitle>
        <AlertDescription>Tente de novo em instantes.</AlertDescription>
      </Alert>
    );
  }

  const contas = contasQuery.data?.contas ?? [];
  const hoje = todayISOLocal();
  const mes = hoje.slice(0, 7);
  const naoPagas = contas.filter((c) => !c.pago);
  const vencidas = naoPagas.filter((c) => c.vencimento < hoje);
  const aPagarMes = naoPagas.filter((c) => c.vencimento.startsWith(mes));
  const pagas = contas
    .filter((c) => c.pago)
    .sort((a, b) => (b.pago_em ?? "").localeCompare(a.pago_em ?? ""));
  const pagasMes = pagas.filter((c) => c.pago_em?.startsWith(mes));
  const soma = (rows: ContaPagarRow[]) => rows.reduce((t, c) => t + (c.valor ?? 0), 0);
  const lista = filtro === "vencidas" ? vencidas : filtro === "pagas" ? pagas : naoPagas;

  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-3">
        <StatCard
          title="A pagar neste mês"
          value={brlFmt.format(soma(aPagarMes))}
          icon={CalendarClock}
          variant="pending"
        />
        <StatCard
          title="Vencidas"
          value={brlFmt.format(soma(vencidas))}
          icon={AlertTriangle}
          variant="critical"
        />
        <StatCard
          title="Pagas neste mês"
          value={brlFmt.format(soma(pagasMes))}
          icon={CheckCircle2}
          variant="success"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filtro} onValueChange={(v) => setFiltro(v as FiltroPagar)}>
          <TabsList>
            <TabsTrigger value="abertas">Em aberto ({naoPagas.length})</TabsTrigger>
            <TabsTrigger value="vencidas">Vencidas ({vencidas.length})</TabsTrigger>
            <TabsTrigger value="pagas">Pagas ({pagas.length})</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          size="lg"
          onClick={() => {
            setEditando(null);
            setDialogAberto(true);
          }}
        >
          <Plus />
          Nova despesa
        </Button>
      </div>

      {lista.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-base">
          {contas.length === 0
            ? "Nenhuma despesa cadastrada ainda. Clique em Nova despesa para começar."
            : filtro === "vencidas"
              ? "Nenhuma conta vencida. Tudo em dia!"
              : filtro === "pagas"
                ? "Nenhuma conta paga ainda."
                : "Nenhuma conta em aberto."}
        </p>
      ) : (
        <div className="space-y-3">
          {lista.map((conta) => {
            const vencida = !conta.pago && conta.vencimento < hoje;
            return (
              <Card key={conta.id}>
                <CardContent className="py-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <div className="min-w-0 flex-1 basis-64">
                    <p className="text-base font-medium truncate">{conta.descricao}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {conta.fornecedor ? `${conta.fornecedor} · ` : ""}
                      {categoriaRotulo(conta.categoria)}
                    </p>
                  </div>
                  <div className="text-sm">
                    <p className="text-muted-foreground">Vencimento</p>
                    <p className="font-medium">{dataBR(conta.vencimento)}</p>
                  </div>
                  <div className="text-sm">
                    <p className="text-muted-foreground">Valor</p>
                    <p className="font-medium">{brlFmt.format(conta.valor)}</p>
                  </div>
                  <SemanticBadge
                    variant={conta.pago ? "success" : vencida ? "critical" : "pending"}
                  >
                    {conta.pago
                      ? `Paga em ${dataBR(conta.pago_em)}`
                      : vencida
                        ? "Vencida"
                        : "Em aberto"}
                  </SemanticBadge>
                  <div className="flex items-center gap-1">
                    {conta.pago ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pagar.isPending}
                        onClick={() => pagar.mutate({ id: conta.id, pago: false })}
                      >
                        Desfazer pagamento
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={pagar.isPending}
                        onClick={() => pagar.mutate({ id: conta.id, pago: true })}
                      >
                        <CheckCircle2 />
                        Marcar como paga
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Editar despesa"
                      onClick={() => {
                        setEditando(conta);
                        setDialogAberto(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label="Excluir despesa">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir esta despesa?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{conta.descricao}" de {brlFmt.format(conta.valor)} será removida de
                            vez. Isso não pode ser desfeito.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => excluir.mutate(conta.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <DespesaDialog open={dialogAberto} onOpenChange={setDialogAberto} conta={editando} />
    </div>
  );
}

const DESPESA_FORM_VAZIO = {
  descricao: "",
  fornecedor: "",
  categoria: "outros",
  vencimento: "",
  valor: "",
  repetirMeses: "0",
};

function DespesaDialog({
  open,
  onOpenChange,
  conta,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conta: ContaPagarRow | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState(DESPESA_FORM_VAZIO);

  useEffect(() => {
    if (!open) return;
    setForm(
      conta
        ? {
            descricao: conta.descricao,
            fornecedor: conta.fornecedor ?? "",
            categoria: conta.categoria,
            vencimento: conta.vencimento,
            valor: String(conta.valor),
            repetirMeses: "0",
          }
        : { ...DESPESA_FORM_VAZIO, vencimento: todayISOLocal() },
    );
  }, [open, conta]);

  const salvar = useMutation({
    mutationFn: () => {
      const base = {
        descricao: form.descricao,
        fornecedor: form.fornecedor || undefined,
        categoria: form.categoria as (typeof CATEGORIAS_DESPESA)[number]["valor"],
        vencimento: form.vencimento,
        valor: Number(form.valor.replace(",", ".")),
      };
      return conta
        ? editarContaPagar({ data: { id: conta.id, ...base } })
        : criarContaPagar({ data: { ...base, repetirMeses: Number(form.repetirMeses) } });
    },
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(
          conta
            ? "Despesa atualizada."
            : "criadas" in res && (res.criadas as number) > 1
              ? `${res.criadas} despesas criadas (uma por mês).`
              : "Despesa criada.",
        );
        onOpenChange(false);
        qc.invalidateQueries({ queryKey: ["fin-contas-pagar"] });
      } else {
        toast.error(res.message);
      }
    },
    onError: () => toast.error("Não consegui salvar a despesa. Tente de novo."),
  });

  const podeSalvar =
    form.descricao.trim().length > 0 &&
    Boolean(form.vencimento) &&
    Number(form.valor.replace(",", ".")) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{conta ? "Editar despesa" : "Nova despesa"}</DialogTitle>
          <DialogDescription>
            {conta
              ? "Ajuste os dados da despesa e salve."
              : "Preencha o que o Instituto tem para pagar."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Descrição</Label>
            <Input
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
              placeholder="Ex.: Aluguel da sede"
            />
          </div>
          <div>
            <Label>Fornecedor (opcional)</Label>
            <Input
              value={form.fornecedor}
              onChange={(e) => setForm((f) => ({ ...f, fornecedor: e.target.value }))}
              placeholder="Ex.: Imobiliária Silva"
            />
          </div>
          <div>
            <Label>Categoria</Label>
            <Select
              value={form.categoria}
              onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS_DESPESA.map((c) => (
                  <SelectItem key={c.valor} value={c.valor}>
                    {c.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Vencimento</Label>
              <Input
                type="date"
                value={form.vencimento}
                onChange={(e) => setForm((f) => ({ ...f, vencimento: e.target.value }))}
              />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input
                inputMode="decimal"
                value={form.valor}
                onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                placeholder="0,00"
              />
            </div>
          </div>
          {!conta && (
            <div>
              <Label>Repetir todo mês?</Label>
              <Select
                value={form.repetirMeses}
                onValueChange={(v) => setForm((f) => ({ ...f, repetirMeses: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Não, só esta vez</SelectItem>
                  {[1, 2, 3, 5, 11].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      Sim, por mais {n} {n === 1 ? "mês" : "meses"} ({n + 1} contas no total)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button disabled={!podeSalvar || salvar.isPending} onClick={() => salvar.mutate()}>
            {salvar.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : conta ? (
              "Salvar alterações"
            ) : (
              "Criar despesa"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BackofficePanel({
  module,
  actionId,
  onActionChange,
  action,
  idValue,
  onIdChange,
  queryText,
  onQueryTextChange,
  bodyText,
  onBodyTextChange,
  isConnected,
  isAdmin,
  canExecute,
  isExecuting,
  onExecute,
  lastResult,
}: {
  module: ContaAzulBackofficeModule;
  actionId: string;
  onActionChange: (value: string) => void;
  action?: ContaAzulBackofficeAction;
  idValue: string;
  onIdChange: (value: string) => void;
  queryText: string;
  onQueryTextChange: (value: string) => void;
  bodyText: string;
  onBodyTextChange: (value: string) => void;
  isConnected: boolean;
  isAdmin: boolean;
  canExecute: boolean;
  isExecuting: boolean;
  onExecute: () => void;
  lastResult: ContaAzulOperationResult | null;
}) {
  const requiresAdmin = action ? action.method !== "GET" || action.dangerous : false;
  const Icon = moduleIcon(module.id);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(380px,0.9fr)_minmax(0,1.1fr)]">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="h-4 w-4" /> {module.label}
              </CardTitle>
              <CardDescription>{module.description}</CardDescription>
            </div>
            <Badge variant="secondary">{module.actions.length} ações</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Operação</Label>
            <Select value={actionId || module.defaultActionId} onValueChange={onActionChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma operação" />
              </SelectTrigger>
              <SelectContent>
                {module.actions.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.method} · {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {action ? (
            <>
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <MethodBadge method={action.method} dangerous={action.dangerous} />
                  {requiresAdmin ? (
                    <Badge variant={isAdmin ? "default" : "destructive"}>Admin</Badge>
                  ) : (
                    <Badge variant="secondary">Consulta</Badge>
                  )}
                  {action.docsUrl ? (
                    <Button asChild variant="ghost" size="sm" className="ml-auto h-7 px-2">
                      <a href={action.docsUrl} target="_blank" rel="noreferrer">
                        Docs <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                  ) : null}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{action.description}</p>
                <code className="mt-3 block break-all rounded-md bg-background px-3 py-2 text-xs">
                  {action.method} {action.path}
                </code>
              </div>

              {action.requiresId ? (
                <div className="space-y-2">
                  <Label htmlFor="conta-azul-id">{action.idLabel || "ID"}</Label>
                  <Input
                    id="conta-azul-id"
                    value={idValue}
                    onChange={(event) => onIdChange(event.target.value)}
                    placeholder="Cole o identificador da Conta Azul"
                  />
                </div>
              ) : null}

              <JsonField
                label="Filtros"
                value={queryText}
                onChange={onQueryTextChange}
                minHeight="min-h-[140px]"
              />

              {action.method !== "GET" ? (
                <JsonField
                  label="Payload"
                  value={bodyText}
                  onChange={onBodyTextChange}
                  minHeight="min-h-[220px]"
                />
              ) : null}

              {!isConnected ? (
                <Alert>
                  <PlugZap className="h-4 w-4" />
                  <AlertTitle>Conta Azul desconectada</AlertTitle>
                  <AlertDescription>
                    Conecte a integração antes de executar operações.
                  </AlertDescription>
                </Alert>
              ) : null}

              {requiresAdmin && !isAdmin ? (
                <Alert variant="destructive">
                  <ShieldCheck className="h-4 w-4" />
                  <AlertTitle>Admin necessário</AlertTitle>
                  <AlertDescription>
                    Esta operação altera dados na Conta Azul e só pode ser executada por admin.
                  </AlertDescription>
                </Alert>
              ) : null}

              <Button className="w-full" onClick={onExecute} disabled={!canExecute}>
                {isExecuting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TerminalSquare className="h-4 w-4" />
                )}
                Executar na Conta Azul
              </Button>
            </>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Nenhuma operação selecionada</AlertTitle>
              <AlertDescription>Selecione uma ação deste módulo para continuar.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <ResultPanel result={lastResult} />
    </div>
  );
}

function ResultPanel({ result }: { result: ContaAzulOperationResult | null }) {
  if (!result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DatabaseZap className="h-4 w-4" /> Resposta
          </CardTitle>
          <CardDescription>
            A última operação executada neste módulo aparecerá aqui.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border/70 p-8 text-center">
            <FileJson className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Aguardando execução</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Use filtros e payload JSON para operar diretamente no backoffice da Conta Azul.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4" /> Resposta da Conta Azul
            </CardTitle>
            <CardDescription>
              {result.method} {result.path}
            </CardDescription>
          </div>
          <Badge variant="secondary">{formatDateTime(result.performedAt)}</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Formato" value={result.responseShape} />
          <Metric label="Itens detectados" value={String(result.itemCount)} />
          <Metric label="Origem da lista" value={result.listSource || "resposta direta"} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <ResultTable result={result} />
        <Separator />
        <div className="space-y-2">
          <Label>JSON bruto</Label>
          <pre className="max-h-[420px] overflow-auto rounded-lg border border-border/60 bg-muted/30 p-4 text-xs leading-relaxed">
            {formatJson(result.data)}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

function ResultTable({ result }: { result: ContaAzulOperationResult }) {
  const rows: ContaAzulResultRow[] = result.items.filter((item): item is ContaAzulResultRow =>
    isRecord(item),
  );

  if (rows.length === 0) {
    return (
      <Alert>
        <FileJson className="h-4 w-4" />
        <AlertTitle>Resposta sem lista tabular</AlertTitle>
        <AlertDescription>
          A Conta Azul retornou um objeto simples, número, texto ou resposta vazia. Veja o JSON
          bruto.
        </AlertDescription>
      </Alert>
    );
  }

  const columns = pickColumns(rows);

  return (
    <div className="overflow-hidden rounded-lg border border-border/60">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column}>{column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 12).map((row, index) => (
            <TableRow key={String(row.id || row.uuid || row.chave || row.numero || index)}>
              {columns.map((column) => (
                <TableCell key={column} className="max-w-[240px] align-top text-xs">
                  {formatCell(row[column])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length > 12 ? (
        <div className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
          Exibindo 12 de {rows.length} itens. O JSON bruto contém a resposta completa.
        </div>
      ) : null}
    </div>
  );
}

function JsonField({
  label,
  value,
  onChange,
  minHeight,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minHeight: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        className={`${minHeight} font-mono text-xs leading-relaxed`}
      />
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

function MethodBadge({
  method,
  dangerous,
}: {
  method: ContaAzulBackofficeAction["method"];
  dangerous?: boolean;
}) {
  if (dangerous) {
    return <Badge variant="destructive">{method}</Badge>;
  }

  if (method === "GET") {
    return <Badge variant="secondary">{method}</Badge>;
  }

  return <Badge>{method}</Badge>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold">{value}</div>
    </div>
  );
}

function moduleIcon(moduleId: string) {
  if (moduleId === "pessoas") return Users;
  if (moduleId === "produtos") return Box;
  if (moduleId === "vendas") return Receipt;
  if (moduleId === "contratos") return ClipboardList;
  if (moduleId === "cobrancas") return Building2;
  if (moduleId === "fiscal") return FileText;
  if (moduleId === "orcamentos") return FileJson;
  return WalletCards;
}

function pickColumns(rows: Record<string, unknown>[]): string[] {
  const preferred = [
    "id",
    "uuid",
    "id_legado",
    "nome",
    "descricao",
    "status",
    "situacao",
    "tipo",
    "numero",
    "data_venda",
    "data_vencimento",
    "valor",
    "valor_total",
    "url",
  ];
  const keys = new Set<string>();

  for (const key of preferred) {
    if (rows.some((row) => key in row)) keys.add(key);
  }

  for (const row of rows.slice(0, 10)) {
    for (const key of Object.keys(row)) {
      keys.add(key);
      if (keys.size >= 7) return Array.from(keys);
    }
  }

  return Array.from(keys).slice(0, 7);
}

function parseJsonRecord(value: string, label: string): ContaAzulJsonRecord {
  if (!value.trim()) return {};
  const parsed = parseJsonValue(value, label);
  if (!isRecord(parsed) || Array.isArray(parsed)) {
    throw new Error(`${label} precisa ser um objeto JSON.`);
  }

  return parsed as ContaAzulJsonRecord;
}

function parseJsonValue(value: string, label: string): ContaAzulJsonValue {
  if (!value.trim()) return {};

  try {
    return JSON.parse(value) as ContaAzulJsonValue;
  } catch (error) {
    throw new Error(`${label} contém JSON inválido: ${errorMessage(error)}`);
  }
}

function formatJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  const text = JSON.stringify(value);
  return text.length > 140 ? `${text.slice(0, 140)}...` : text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
    return "Os secrets da Conta Azul ainda não estão configurados no ambiente Lovable. Confira CONTA_AZUL_CLIENT_ID, CONTA_AZUL_CLIENT_SECRET, CONTA_AZUL_REDIRECT_URI, CONTA_AZUL_OAUTH_STATE_SECRET e CONTA_AZUL_TOKEN_ENCRYPTION_KEY.";
  }

  if (reason === "not_admin") {
    return "Apenas administradores podem conectar ou desconectar a Conta Azul.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Não foi possível verificar a integração. Confira as migrations e os secrets do ambiente.";
}

function openContaAzulAuthUrl(url: string, authWindow: Window | null): boolean {
  if (authWindow && !authWindow.closed) {
    try {
      authWindow.location.replace(url);
      return true;
    } catch {
      authWindow.close();
    }
  }

  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (opened) {
    return true;
  }

  return false;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }

  return "Erro ao iniciar OAuth da Conta Azul.";
}

function formatDateTime(value: string | null): string {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
