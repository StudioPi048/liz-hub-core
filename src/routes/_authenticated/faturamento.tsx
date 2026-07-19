import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getFaturamentoParcelas,
  getFaturamentoRelatorios,
  getFaturamentoResumo,
  getNotasFiscais,
  importarFaturamento,
  marcarNotaEmitida,
  type FaturamentoRelatorios,
  type NfFilaRow,
  type ParcelaRow,
} from "@/lib/faturamento.functions";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
import { SemanticBadge } from "@/components/SemanticBadge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/faturamento")({
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

type Escopo = "mes" | "atrasadas" | "busca" | "notas" | "relatorios";

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
  const queryClient = useQueryClient();
  const [escopo, setEscopo] = useState<Escopo>("mes");
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resumoQuery = useQuery({
    queryKey: ["faturamento-resumo"],
    queryFn: () => getFaturamentoResumo(),
  });

  const parcelasQuery = useQuery({
    queryKey: ["faturamento-parcelas", escopo, buscaAtiva],
    queryFn: async () => {
      const res = await getFaturamentoParcelas({
        data: { escopo: escopo as "mes" | "atrasadas" | "busca", busca: buscaAtiva || undefined },
      });
      return res.parcelas;
    },
    enabled:
      escopo === "mes" || escopo === "atrasadas" || (escopo === "busca" && buscaAtiva.length > 0),
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
          <Button
            size="lg"
            variant="secondary"
            disabled={importar.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload />
            Enviar arquivo da planilha
          </Button>
          <Button
            size="lg"
            onClick={() => importar.mutate(undefined)}
            disabled={importar.isPending}
          >
            <RefreshCw className={importar.isPending ? "animate-spin" : ""} />
            {importar.isPending ? "Atualizando..." : "Atualizar da planilha"}
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
              Clique no botão <strong>Atualizar da planilha</strong> ali em cima para trazer tudo da
              planilha do Drive. Leva menos de um minuto.
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

      <Tabs value={escopo} onValueChange={(v) => setEscopo(v as Escopo)}>
        <TabsList>
          <TabsTrigger value="mes">Cobranças do mês</TabsTrigger>
          <TabsTrigger value="atrasadas">
            Em atraso{resumo ? ` (${resumo.emAtraso.quantidade})` : ""}
          </TabsTrigger>
          <TabsTrigger value="busca">Buscar cliente</TabsTrigger>
          <TabsTrigger value="notas">Notas fiscais</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
        </TabsList>
      </Tabs>

      {escopo === "busca" && (
        <form
          className="flex gap-2 max-w-xl"
          onSubmit={(e) => {
            e.preventDefault();
            setBuscaAtiva(busca);
          }}
        >
          <Input
            placeholder="Digite o nome ou CPF do cliente"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="h-11 text-base"
          />
          <Button type="submit" size="lg">
            <Search />
            Buscar
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
