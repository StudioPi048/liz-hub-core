import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getFaturamentoParcelas,
  getFaturamentoResumo,
  importarFaturamento,
  type ParcelaRow,
} from "@/lib/faturamento.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/StatCard";
import { SemanticBadge } from "@/components/SemanticBadge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarClock, CheckCircle2, AlertTriangle, RefreshCw, Search } from "lucide-react";
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

type Escopo = "mes" | "atrasadas" | "busca";

function FaturamentoPage() {
  const queryClient = useQueryClient();
  const [escopo, setEscopo] = useState<Escopo>("mes");
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState("");

  const resumoQuery = useQuery({
    queryKey: ["faturamento-resumo"],
    queryFn: () => getFaturamentoResumo(),
  });

  const parcelasQuery = useQuery({
    queryKey: ["faturamento-parcelas", escopo, buscaAtiva],
    queryFn: async () => {
      const res = await getFaturamentoParcelas({
        data: { escopo, busca: buscaAtiva || undefined },
      });
      return res.parcelas;
    },
    enabled: escopo !== "busca" || buscaAtiva.length > 0,
  });

  const importar = useMutation({
    mutationFn: () => importarFaturamento(),
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
        <Button size="lg" onClick={() => importar.mutate()} disabled={importar.isPending}>
          <RefreshCw className={importar.isPending ? "animate-spin" : ""} />
          {importar.isPending ? "Atualizando..." : "Atualizar da planilha"}
        </Button>
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

      <ParcelasLista
        parcelas={parcelasQuery.data ?? []}
        loading={parcelasQuery.isLoading}
        escopo={escopo}
        buscou={buscaAtiva.length > 0}
      />
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
