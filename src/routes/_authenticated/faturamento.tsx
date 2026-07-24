import { useRef, useState } from "react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  getAlunos,
  getCursosPlanos,
  getFaturamentoParcelas,
  getFaturamentoRelatorios,
  getFaturamentoResumo,
  getNotasFiscais,
  desfazerBaixaParcela,
  importarFaturamento,
  marcarNotaEmitida,
  marcarParcelaRecebida,
  registrarVenda,
  type AlunoResumo,
  type FaturamentoRelatorios,
  type NfFilaRow,
  type ParcelaRow,
} from "@/lib/faturamento.functions";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
import { SemanticBadge } from "@/components/SemanticBadge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  MessageCircle,
  Copy,
  FileText,
  Upload,
  Plus,
  ChevronsUpDown,
  Loader2,
  Undo2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const faturamentoSearchSchema = z.object({
  busca: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/faturamento")({
  validateSearch: faturamentoSearchSchema,
  component: FaturamentoPage,
});

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function dataBR(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const STATUS_LABEL: Record<string, string> = {
  pago: "Pago",
  aberto: "Em aberto",
  cancelado: "Cancelado",
  perda: "Perda",
  permuta: "Permuta",
  novo_contrato: "Novo contrato",
  outro: "Outro",
};

const STATUS_VARIANT: Record<string, "neutral" | "pending" | "success" | "critical"> = {
  pago: "success",
  aberto: "pending",
  cancelado: "neutral",
  perda: "critical",
  permuta: "neutral",
  novo_contrato: "neutral",
  outro: "neutral",
};

type Escopo = "mes" | "atrasadas" | "recebidos" | "busca" | "notas" | "relatorios";
type Grupo = "cobrancas" | "notas" | "relatorios";

const COBRANCAS_ESCOPO_PADRAO: Escopo = "mes";

function grupoDeEscopo(e: Escopo): Grupo {
  if (e === "notas") return "notas";
  if (e === "relatorios") return "relatorios";
  return "cobrancas";
}

function waLink(fone: string, mensagem: string): string {
  let digits = fone.replace(/\D/g, "");
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(mensagem)}`;
}

function mensagemCobranca(p: ParcelaRow): string {
  const primeiroNome = (p.nome_cliente ?? "").trim().split(/\s+/)[0] || "tudo bem";
  const valor = brl.format(p.valor_liquido ?? p.valor_parcela ?? 0);
  const venc = p.vcto ? ` com vencimento em ${dataBR(p.vcto)}` : "";
  const curso = p.curso_nome ? ` referente a ${p.curso_nome}` : "";
  return `Olá, ${primeiroNome}! Passando para lembrar da parcela de ${valor}${curso}${venc}. Qualquer dúvida, estou à disposição. Instituto Liz`;
}

function FaturamentoPage() {
  const search = useSearch({ from: "/_authenticated/faturamento" });
  const queryClient = useQueryClient();
  const [escopo, setEscopo] = useState<Escopo>(search.busca ? "busca" : "mes");
  const [busca, setBusca] = useState(search.busca ?? "");
  const [buscaAtiva, setBuscaAtiva] = useState(search.busca ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resumoQuery = useQuery({
    queryKey: ["faturamento-resumo"],
    queryFn: () => getFaturamentoResumo(),
  });

  const parcelasQuery = useQuery({
    queryKey: ["faturamento-parcelas", escopo, buscaAtiva],
    queryFn: async () => {
      const res = await getFaturamentoParcelas({
        data: {
          escopo: escopo as "mes" | "atrasadas" | "recebidos" | "busca",
          busca: buscaAtiva || undefined,
        },
      });
      return res.parcelas;
    },
    enabled:
      escopo === "mes" ||
      escopo === "atrasadas" ||
      escopo === "recebidos" ||
      (escopo === "busca" && buscaAtiva.length > 0),
  });

  const notasQuery = useQuery({
    queryKey: ["faturamento-notas"],
    queryFn: () => getNotasFiscais(),
    enabled: escopo === "notas",
  });

  const relatoriosQuery = useQuery({
    queryKey: ["faturamento-relatorios"],
    queryFn: () => getFaturamentoRelatorios(),
    enabled: escopo === "relatorios",
  });

  const importar = useMutation({
    mutationFn: (arquivoBase64?: string) => importarFaturamento({ data: { arquivoBase64 } }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(
          `Planilha importada: ${res.counts.parcelas} parcelas, ${res.counts.clientes} clientes.`,
        );
        queryClient.invalidateQueries({ queryKey: ["faturamento-resumo"] });
        queryClient.invalidateQueries({ queryKey: ["faturamento-parcelas"] });
      } else {
        toast.error(res.message);
      }
    },
    onError: () => toast.error("Não consegui atualizar agora. Tente de novo em instantes."),
  });

  const resumo = resumoQuery.data;
  const nuncaImportado = resumo && resumo.importadoEm === null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-editorial tracking-tight">Faturamento</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {resumo?.importadoEm
              ? `Planilha atualizada em ${format(new Date(resumo.importadoEm), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}`
              : "Dados da planilha de faturamento do Instituto Liz"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NovaVendaDialog />
          <Button
            size="lg"
            variant="secondary"
            disabled={importar.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {importar.isPending ? <RefreshCw className="animate-spin" /> : <Upload />}
            {importar.isPending ? "Atualizando..." : "Enviar arquivo da planilha"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const buf = await file.arrayBuffer();
              // ArrayBuffer -> base64 em blocos (evita estourar a pilha com arquivos grandes).
              const bytes = new Uint8Array(buf);
              let bin = "";
              for (let i = 0; i < bytes.length; i += 8192) {
                bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
              }
              importar.mutate(btoa(bin));
            }}
          />
        </div>
      </div>

      {nuncaImportado ? (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <p className="text-lg">Os dados ainda não foram importados.</p>
            <p className="text-sm text-muted-foreground">
              Clique no botão <strong>Enviar arquivo da planilha</strong> ali em cima e escolha o
              arquivo da planilha no seu computador. Leva menos de um minuto.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-3">
          <StatCard
            title="A receber neste mês"
            value={resumo ? brl.format(resumo.aReceberMes.total) : "–"}
            icon={CalendarClock}
            variant="pending"
          />
          <StatCard
            title="Recebido neste mês"
            value={resumo ? brl.format(resumo.recebidoMes.total) : "–"}
            icon={CheckCircle2}
            variant="success"
          />
          <StatCard
            title="Em atraso"
            value={resumo ? brl.format(resumo.emAtraso.total) : "–"}
            icon={AlertTriangle}
            variant="critical"
          />
        </div>
      )}

      <Tabs
        value={grupoDeEscopo(escopo)}
        onValueChange={(v) => {
          const grupo = v as Grupo;
          if (grupo === "notas") setEscopo("notas");
          else if (grupo === "relatorios") setEscopo("relatorios");
          else setEscopo(COBRANCAS_ESCOPO_PADRAO);
        }}
      >
        <TabsList>
          <TabsTrigger value="cobrancas">Cobranças</TabsTrigger>
          <TabsTrigger value="notas">Notas fiscais</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
        </TabsList>
      </Tabs>

      {grupoDeEscopo(escopo) === "cobrancas" && (
        <Tabs value={escopo} onValueChange={(v) => setEscopo(v as Escopo)}>
          <TabsList>
            <TabsTrigger value="mes">Do mês</TabsTrigger>
            <TabsTrigger value="atrasadas">
              Em atraso{resumo ? ` (${resumo.emAtraso.quantidade})` : ""}
            </TabsTrigger>
            <TabsTrigger value="recebidos">Recebidos</TabsTrigger>
            <TabsTrigger value="busca">Buscar cliente</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {(escopo === "busca" || escopo === "recebidos") && (
        <form
          className="flex gap-2 max-w-xl"
          onSubmit={(e) => {
            e.preventDefault();
            setBuscaAtiva(busca);
          }}
        >
          <Input
            placeholder={
              escopo === "recebidos"
                ? "Filtrar por nome ou CPF (opcional)"
                : "Digite o nome ou CPF do cliente"
            }
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-11 text-base"
          />
          <Button type="submit" size="lg">
            <Search />
            {escopo === "recebidos" ? "Filtrar" : "Buscar"}
          </Button>
        </form>
      )}

      {escopo === "notas" ? (
        <NotasFiscaisSecao
          fila={notasQuery.data?.fila ?? []}
          emitidas={notasQuery.data?.emitidas ?? []}
          loading={notasQuery.isLoading}
        />
      ) : escopo === "relatorios" ? (
        <RelatoriosSecao dados={relatoriosQuery.data} loading={relatoriosQuery.isLoading} />
      ) : (
        <ParcelasLista
          parcelas={parcelasQuery.data ?? []}
          loading={parcelasQuery.isLoading}
          escopo={escopo}
          buscou={buscaAtiva.length > 0}
        />
      )}
    </div>
  );
}

const VENDA_FORM_VAZIO = {
  cpf: "",
  cursoCodigo: "",
  planoId: "",
  valorVenda: "",
  desconto: "",
  dtVenda: new Date().toISOString().slice(0, 10),
  presencial: false,
};

function NovaVendaDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [alunoAberto, setAlunoAberto] = useState(false);
  const [form, setForm] = useState(VENDA_FORM_VAZIO);

  const alunosQuery = useQuery({
    queryKey: ["fat-alunos"],
    queryFn: async () => (await getAlunos()).alunos,
    enabled: open,
  });
  const cursosPlanosQuery = useQuery({
    queryKey: ["fat-cursos-planos"],
    queryFn: () => getCursosPlanos(),
    enabled: open,
  });

  const alunoSelecionado = alunosQuery.data?.find((a) => a.cpf === form.cpf);
  const cursoSelecionado = cursosPlanosQuery.data?.cursos.find(
    (c) => c.codigo === form.cursoCodigo,
  );
  const planoSelecionado = cursosPlanosQuery.data?.planos.find((p) => p.id_plano === form.planoId);

  const registrar = useMutation({
    mutationFn: () =>
      registrarVenda({
        data: {
          cpf: form.cpf,
          cursoCodigo: form.cursoCodigo,
          planoId: form.planoId,
          valorVenda: Number(form.valorVenda.replace(",", ".")),
          desconto: form.desconto ? Number(form.desconto.replace(",", ".")) : undefined,
          dtVenda: form.dtVenda,
          presencial: form.presencial,
        },
      }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(`Venda registrada: ${res.numParcelas} parcela(s) geradas.`);
        setOpen(false);
        setForm(VENDA_FORM_VAZIO);
        queryClient.invalidateQueries({ queryKey: ["faturamento-resumo"] });
        queryClient.invalidateQueries({ queryKey: ["faturamento-parcelas"] });
        queryClient.invalidateQueries({ queryKey: ["fat-alunos"] });
      } else {
        toast.error(res.message);
      }
    },
    onError: () => toast.error("Não consegui registrar a venda agora. Tente de novo em instantes."),
  });

  const podeAvancar = Boolean(form.cpf && form.cursoCodigo);
  const podeSalvar = form.cpf && form.cursoCodigo && form.planoId && Number(form.valorVenda) > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setForm(VENDA_FORM_VAZIO);
          setStep(1);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg">
          <Plus />
          Nova venda
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar venda nova</DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Passo 1 de 2: escolha o aluno e o curso."
              : "Passo 2 de 2: confirme o plano e os valores. As parcelas são geradas automaticamente."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="grid gap-3">
            <div>
              <Label>Aluno</Label>
              <Popover open={alunoAberto} onOpenChange={setAlunoAberto}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    {alunoSelecionado ? alunoSelecionado.nome : "Buscar aluno por nome ou CPF..."}
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  {/* Busca por substring (não fuzzy do cmdk): mesmo padrão da busca de
                      alunos em /crm, previsível para quem digita o nome completo. */}
                  <Command
                    filter={(value, search) =>
                      value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                    }
                  >
                    <CommandInput placeholder="Nome ou CPF..." />
                    <CommandList>
                      <CommandEmpty>
                        {alunosQuery.isLoading ? "Carregando..." : "Nenhum aluno encontrado."}
                      </CommandEmpty>
                      <CommandGroup>
                        {(alunosQuery.data ?? []).map((a: AlunoResumo) => (
                          <CommandItem
                            key={a.cpf}
                            value={`${a.nome} ${a.cpf}`}
                            onSelect={() => {
                              setForm((f) => ({ ...f, cpf: a.cpf }));
                              setAlunoAberto(false);
                            }}
                          >
                            {a.nome}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="mt-1 text-xs text-muted-foreground">
                Aluno novo? Cadastre em Clientes → Alunos → Novo aluno primeiro.
              </p>
            </div>

            <div>
              <Label>Curso</Label>
              <Select
                value={form.cursoCodigo}
                onValueChange={(v) => {
                  const curso = cursosPlanosQuery.data?.cursos.find((c) => c.codigo === v);
                  setForm((f) => ({
                    ...f,
                    cursoCodigo: v,
                    valorVenda: f.valorVenda || String(curso?.valor_brl ?? ""),
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o curso" />
                </SelectTrigger>
                <SelectContent>
                  {(cursosPlanosQuery.data?.cursos ?? []).map((c) => (
                    <SelectItem key={c.codigo} value={c.codigo}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-3">
            <p className="rounded-md bg-muted/50 px-3 py-2 text-sm">
              <span className="font-medium">{alunoSelecionado?.nome}</span>
              {" · "}
              {cursoSelecionado?.nome}
              <Button
                variant="link"
                size="sm"
                className="ml-1 h-auto p-0 align-baseline"
                onClick={() => setStep(1)}
              >
                trocar
              </Button>
            </p>

            <div>
              <Label>Plano de pagamento</Label>
              <Select
                value={form.planoId}
                onValueChange={(v) => setForm((f) => ({ ...f, planoId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  {(cursosPlanosQuery.data?.planos ?? []).map((p) => (
                    <SelectItem key={p.id_plano} value={p.id_plano}>
                      {p.nome} {p.parcelas ? `(${p.parcelas}x)` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {planoSelecionado && form.planoId && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Gera {planoSelecionado.parcelas ?? 1} parcela(s)
                  {planoSelecionado.prazo_dias ? ` em até ${planoSelecionado.prazo_dias} dias` : ""}
                  .
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor da venda (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={form.valorVenda}
                  onChange={(e) => setForm((f) => ({ ...f, valorVenda: e.target.value }))}
                  placeholder={
                    cursoSelecionado?.valor_brl ? String(cursoSelecionado.valor_brl) : "0,00"
                  }
                />
              </div>
              <div>
                <Label>Desconto (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={form.desconto}
                  onChange={(e) => setForm((f) => ({ ...f, desconto: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div>
              <Label>Data da venda</Label>
              <Input
                type="date"
                value={form.dtVenda}
                onChange={(e) => setForm((f) => ({ ...f, dtVenda: e.target.value }))}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.presencial}
                onCheckedChange={(v) => setForm((f) => ({ ...f, presencial: v === true }))}
              />
              Curso presencial (entra sozinho na fila de nota fiscal)
            </label>
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <Button disabled={!podeAvancar} onClick={() => setStep(2)}>
              Continuar
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button
                disabled={!podeSalvar || registrar.isPending}
                onClick={() => registrar.mutate()}
              >
                {registrar.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Registrar venda"
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ParcelasLista({
  parcelas,
  loading,
  escopo,
  buscou,
}: {
  parcelas: ParcelaRow[];
  loading: boolean;
  escopo: Escopo;
  buscou: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (parcelas.length === 0) {
    const msg =
      escopo === "mes"
        ? "Nenhuma cobrança em aberto neste mês."
        : escopo === "atrasadas"
          ? "Nenhuma parcela em atraso. Tudo em dia!"
          : escopo === "recebidos"
            ? "Nenhuma parcela recebida ainda."
            : buscou
              ? "Nenhum resultado. Confira o nome ou CPF e tente de novo."
              : "Digite o nome ou CPF do cliente e clique em Buscar.";
    return <p className="text-muted-foreground py-8 text-center text-base">{msg}</p>;
  }

  return (
    <div className="space-y-3">
      {parcelas.map((p) => (
        <Card key={p.id}>
          <CardContent className="py-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="min-w-0 flex-1 basis-64">
              <p className="text-base font-medium truncate">{p.nome_cliente ?? "Sem nome"}</p>
              <p className="text-sm text-muted-foreground truncate">
                {p.curso_nome ?? "—"}
                {p.plano_nome ? ` · ${p.plano_nome}` : ""}
              </p>
            </div>
            <div className="text-sm">
              <p className="text-muted-foreground">Vencimento</p>
              <p className="font-medium">{dataBR(p.vcto)}</p>
            </div>
            <div className="text-sm">
              <p className="text-muted-foreground">Valor</p>
              <p className="font-medium">{brl.format(p.valor_liquido ?? p.valor_parcela ?? 0)}</p>
            </div>
            <SemanticBadge variant={STATUS_VARIANT[p.status] ?? "neutral"}>
              {STATUS_LABEL[p.status] ?? p.status}
              {p.status === "aberto" && p.atraso_dias && p.atraso_dias > 0
                ? ` · ${p.atraso_dias}d atraso`
                : ""}
            </SemanticBadge>
            {p.status === "aberto" && p.fone && (
              <Button variant="secondary" size="sm" asChild>
                <a href={waLink(p.fone, mensagemCobranca(p))} target="_blank" rel="noreferrer">
                  <MessageCircle />
                  Cobrar no WhatsApp
                </a>
              </Button>
            )}
            {p.status === "aberto" && <MarcarRecebidoBtn p={p} />}
            {p.status === "pago" && <DesfazerBaixaBtn p={p} />}
          </CardContent>
        </Card>
      ))}
      {parcelas.length >= 300 && (
        <p className="text-sm text-muted-foreground text-center">
          Mostrando as primeiras 300 parcelas. Use a busca para encontrar um cliente específico.
        </p>
      )}
    </div>
  );
}

function MarcarRecebidoBtn({ p }: { p: ParcelaRow }) {
  const queryClient = useQueryClient();
  const marcar = useMutation({
    mutationFn: () =>
      marcarParcelaRecebida({
        data: {
          parcelaId: p.id,
          cpf: p.cpf,
          vcto: p.vcto,
          valor_parcela: p.valor_parcela,
          parcela_num: p.parcela_num,
          curso_nome: p.curso_nome,
          nome_cliente: p.nome_cliente,
          valor_recebido: p.valor_liquido ?? p.valor_parcela,
        },
      }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(`Parcela de ${p.nome_cliente ?? "cliente"} marcada como recebida.`);
        queryClient.invalidateQueries({ queryKey: ["faturamento-resumo"] });
        queryClient.invalidateQueries({ queryKey: ["faturamento-parcelas"] });
      } else {
        toast.error(res.message);
      }
    },
    onError: () => toast.error("Não consegui salvar agora. Tente de novo em instantes."),
  });

  return (
    <Button size="sm" disabled={marcar.isPending} onClick={() => marcar.mutate()}>
      <CheckCircle2 />
      {marcar.isPending ? "Salvando..." : "Marcar recebido"}
    </Button>
  );
}

function DesfazerBaixaBtn({ p }: { p: ParcelaRow }) {
  const queryClient = useQueryClient();
  const desfazer = useMutation({
    mutationFn: () =>
      desfazerBaixaParcela({
        data: {
          parcelaId: p.id,
          cpf: p.cpf,
          vcto: p.vcto,
          valor_parcela: p.valor_parcela,
          parcela_num: p.parcela_num,
        },
      }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(
          `Baixa de ${p.nome_cliente ?? "cliente"} desfeita. Parcela voltou a "Em aberto".`,
        );
        queryClient.invalidateQueries({ queryKey: ["faturamento-resumo"] });
        queryClient.invalidateQueries({ queryKey: ["faturamento-parcelas"] });
      } else {
        toast.error(res.message);
      }
    },
    onError: () => toast.error("Não consegui desfazer agora. Tente de novo em instantes."),
  });

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={desfazer.isPending}
      onClick={() => desfazer.mutate()}
    >
      <Undo2 />
      {desfazer.isPending ? "Desfazendo..." : "Desfazer baixa"}
    </Button>
  );
}

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

function RelatoriosSecao({
  dados,
  loading,
}: {
  dados: FaturamentoRelatorios | undefined;
  loading: boolean;
}) {
  if (loading || !dados) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const porMes = dados.recebidoPorMes.map((r) => ({ ...r, label: mesLabel(r.mes) }));
  const porCurso = dados.recebidoPorCurso.map((r) => ({
    ...r,
    label: r.curso.length > 28 ? `${r.curso.slice(0, 28)}…` : r.curso,
  }));

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h2 className="text-lg font-medium">Recebido por mês (últimos 12 meses)</h2>
        <ChartContainer config={{ total: { label: "Recebido", color: "hsl(var(--primary))" } }}>
          <BarChart data={porMes}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => brl.format(v).replace(",00", "")}
              width={80}
            />
            <ChartTooltip
              content={<ChartTooltipContent formatter={(v) => brl.format(Number(v))} />}
            />
            <Bar dataKey="total" fill="var(--color-total)" radius={4} />
          </BarChart>
        </ChartContainer>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Recebido por curso (top 10, últimos 12 meses)</h2>
        {porCurso.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">Nenhum recebimento no período.</p>
        ) : (
          <ChartContainer
            config={{ total: { label: "Recebido", color: "hsl(var(--primary))" } }}
            className="aspect-auto h-96"
          >
            <BarChart data={porCurso} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid horizontal={false} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => brl.format(v).replace(",00", "")}
              />
              <YAxis
                dataKey="label"
                type="category"
                tickLine={false}
                axisLine={false}
                width={180}
              />
              <ChartTooltip
                content={<ChartTooltipContent formatter={(v) => brl.format(Number(v))} />}
              />
              <Bar dataKey="total" fill="var(--color-total)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </div>
    </div>
  );
}

function dadosNfParaCopiar(nf: NfFilaRow): string {
  return [
    `Nome: ${nf.nome ?? ""}`,
    `CPF: ${nf.cpf ?? ""}`,
    `E-mail: ${nf.email ?? ""}`,
    `Endereço: ${nf.endereco ?? ""}`,
    `Cidade/UF: ${nf.cidade_uf ?? ""}`,
    `Telefone: ${nf.fone ?? ""}`,
    `Serviço: ${nf.curso_nome ?? ""}`,
    `Valor: ${brl.format(nf.valor_venda ?? 0)}`,
    `Plano: ${nf.plano_nome ?? ""}`,
  ].join("\n");
}

function NfFilaCard({ nf }: { nf: NfFilaRow }) {
  const queryClient = useQueryClient();
  const [numero, setNumero] = useState("");

  const marcar = useMutation({
    mutationFn: () =>
      marcarNotaEmitida({
        data: {
          cpf: nf.cpf,
          nome: nf.nome,
          curso_nome: nf.curso_nome,
          valor: nf.valor_venda,
          numero: numero.trim(),
        },
      }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(`Nota de ${nf.nome ?? "cliente"} marcada como emitida.`);
        queryClient.invalidateQueries({ queryKey: ["faturamento-notas"] });
      } else {
        toast.error(res.message);
      }
    },
    onError: () => toast.error("Não consegui salvar agora. Tente de novo em instantes."),
  });

  return (
    <Card>
      <CardContent className="py-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="min-w-0 flex-1 basis-64">
          <p className="text-base font-medium truncate">{nf.nome ?? "Sem nome"}</p>
          <p className="text-sm text-muted-foreground truncate">
            {nf.curso_nome ?? "—"}
            {nf.plano_nome ? ` · ${nf.plano_nome}` : ""}
          </p>
          <p className="text-sm text-muted-foreground truncate">
            CPF {nf.cpf ?? "—"} · {nf.cidade_uf ?? "—"}
          </p>
        </div>
        <div className="text-sm text-right">
          <p className="text-muted-foreground">Valor</p>
          <p className="font-medium">{brl.format(nf.valor_venda ?? 0)}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(dadosNfParaCopiar(nf));
            toast.success(`Dados de ${nf.nome ?? "cliente"} copiados`);
          }}
        >
          <Copy />
          Copiar dados
        </Button>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!numero.trim()) {
              toast.error("Digite o número da nota antes de marcar.");
              return;
            }
            marcar.mutate();
          }}
        >
          <Input
            placeholder="Nº da nota"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            className="w-28"
          />
          <Button type="submit" size="sm" disabled={marcar.isPending}>
            <CheckCircle2 />
            {marcar.isPending ? "Salvando..." : "Marcar como emitida"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function NotasFiscaisSecao({
  fila,
  emitidas,
  loading,
}: {
  fila: NfFilaRow[];
  emitidas: {
    id: number;
    data: string | null;
    cliente: string | null;
    numero: string | null;
    valor: number | null;
  }[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h2 className="text-lg font-medium flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Notas para emitir ({fila.length})
        </h2>
        <p className="text-sm text-muted-foreground">
          Clique em copiar e cole os dados no sistema Senior para emitir a nota. Depois de emitir,
          digite o número da nota e clique em "Marcar como emitida".
        </p>
        {fila.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">
            Nenhuma nota aguardando emissão. Tudo em dia!
          </p>
        ) : (
          fila.map((nf) => <NfFilaCard key={nf.id} nf={nf} />)
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Notas já emitidas ({emitidas.length})</h2>
        {emitidas.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">Nenhuma nota registrada.</p>
        ) : (
          <div className="space-y-2">
            {emitidas.map((nf) => (
              <Card key={nf.id}>
                <CardContent className="py-3 flex flex-wrap items-center gap-x-6 gap-y-1">
                  <p className="min-w-0 flex-1 basis-64 text-base font-medium truncate">
                    {nf.cliente ?? "Sem nome"}
                  </p>
                  <span className="text-sm text-muted-foreground">NF {nf.numero ?? "—"}</span>
                  <span className="text-sm text-muted-foreground">{dataBR(nf.data)}</span>
                  <span className="text-sm font-medium">{brl.format(nf.valor ?? 0)}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
