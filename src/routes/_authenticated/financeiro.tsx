import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CATEGORIAS_DESPESA,
  criarContaPagar,
  editarContaPagar,
  excluirContaPagar,
  getContasPagar,
  getFluxoCaixa,
  marcarContaPaga,
  type ContaPagarRow,
  type FluxoCaixaMes,
} from "@/lib/financeiro.functions";
import { StatCard, StatCardRow } from "@/components/StatCard";
import { SemanticBadge } from "@/components/SemanticBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Scale,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: FinanceiroPage,
});

function FinanceiroPage() {
  return (
    <div className="max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-editorial tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Despesas do Instituto e fluxo de caixa: o que entra vem do Faturamento, o que sai vem das
          contas daqui.
        </p>
      </div>

      <Tabs defaultValue="pagar">
        <TabsList>
          <TabsTrigger value="pagar">Contas a pagar</TabsTrigger>
          <TabsTrigger value="caixa">Caixa</TabsTrigger>
        </TabsList>
        <TabsContent value="pagar" className="mt-6">
          <ContasAPagarSecao />
        </TabsContent>
        <TabsContent value="caixa" className="mt-6">
          <CaixaSecao />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const MES_ABREV = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function mesLabel(mes: string): string {
  const [ano, m] = mes.split("-");
  return `${MES_ABREV[Number(m) - 1]}/${ano.slice(2)}`;
}

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

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["fin-contas-pagar"] });
    qc.invalidateQueries({ queryKey: ["fin-fluxo-caixa"] });
  };

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
      <StatCardRow>
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
      </StatCardRow>

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
        qc.invalidateQueries({ queryKey: ["fin-fluxo-caixa"] });
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

function CaixaSecao() {
  const caixaQuery = useQuery({
    queryKey: ["fin-fluxo-caixa"],
    queryFn: () => getFluxoCaixa(),
  });

  if (caixaQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (caixaQuery.isError || !caixaQuery.data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Não consegui montar o fluxo de caixa</AlertTitle>
        <AlertDescription>Tente de novo em instantes.</AlertDescription>
      </Alert>
    );
  }

  const { historico, projecao } = caixaQuery.data;
  const mesCorrente = historico[historico.length - 1];
  const saldoMes = (mesCorrente?.entradas ?? 0) - (mesCorrente?.saidas ?? 0);
  const dadosGrafico = historico.map((m: FluxoCaixaMes) => ({ ...m, label: mesLabel(m.mes) }));

  return (
    <div className="space-y-8">
      <StatCardRow>
        <StatCard
          title="Entrou neste mês"
          value={brlFmt.format(mesCorrente?.entradas ?? 0)}
          icon={ArrowUpCircle}
          variant="success"
        />
        <StatCard
          title="Saiu neste mês"
          value={brlFmt.format(mesCorrente?.saidas ?? 0)}
          icon={ArrowDownCircle}
          variant="critical"
        />
        <StatCard
          title="Saldo do mês"
          value={brlFmt.format(saldoMes)}
          icon={Scale}
          variant={saldoMes >= 0 ? "success" : "critical"}
        />
      </StatCardRow>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Entradas x saídas (últimos 12 meses)</h2>
        <p className="text-sm text-muted-foreground">
          Entradas são as parcelas recebidas no Faturamento. Saídas são as despesas pagas aqui no
          Financeiro.
        </p>
        <ChartContainer
          config={{
            entradas: { label: "Entradas", color: "hsl(var(--primary))" },
            saidas: { label: "Saídas", color: "hsl(var(--destructive))" },
          }}
        >
          <BarChart data={dadosGrafico}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => brlFmt.format(v).replace(",00", "")}
              width={80}
            />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(v) => brlFmt.format(Number(v))} />}
            />
            <Bar dataKey="entradas" fill="var(--color-entradas)" radius={4} />
            <Bar dataKey="saidas" fill="var(--color-saidas)" radius={4} />
          </BarChart>
        </ChartContainer>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Previsão dos próximos meses</h2>
        <p className="text-sm text-muted-foreground">
          A receber (parcelas em aberto do Faturamento) menos a pagar (contas em aberto daqui).
          Parcelas e contas atrasadas entram no mês atual.
        </p>
        <div className="overflow-hidden rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">A receber</TableHead>
                <TableHead className="text-right">A pagar</TableHead>
                <TableHead className="text-right">Saldo previsto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projecao.map((m: FluxoCaixaMes) => {
                const saldo = m.entradas - m.saidas;
                return (
                  <TableRow key={m.mes}>
                    <TableCell className="font-medium">{mesLabel(m.mes)}</TableCell>
                    <TableCell className="text-right">{brlFmt.format(m.entradas)}</TableCell>
                    <TableCell className="text-right">{brlFmt.format(m.saidas)}</TableCell>
                    <TableCell
                      className={`text-right font-semibold ${saldo < 0 ? "text-destructive" : ""}`}
                    >
                      {brlFmt.format(saldo)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
