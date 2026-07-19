import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAlunos, type AlunoResumo } from "@/lib/faturamento.functions";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SemanticBadge } from "@/components/SemanticBadge";
import { Search, GraduationCap } from "lucide-react";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type Filtro = "todos" | "atrasados" | "em_dia" | "sem_compras";

const FILTRO_LABEL: Record<Filtro, string> = {
  todos: "Todos os alunos",
  atrasados: "Com parcelas em atraso",
  em_dia: "Em dia",
  sem_compras: "Sem compras registradas",
};

export function AlunosPlanilhaTab() {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const alunosQuery = useQuery({
    queryKey: ["fat-alunos"],
    queryFn: async () => (await getAlunos()).alunos,
  });

  const alunos = useMemo(() => alunosQuery.data ?? [], [alunosQuery.data]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return alunos.filter((a) => {
      if (filtro === "atrasados" && a.parcelas_atrasadas === 0) return false;
      if (filtro === "em_dia" && (a.parcelas_atrasadas > 0 || a.cursos.length === 0)) return false;
      if (filtro === "sem_compras" && a.cursos.length > 0) return false;
      if (!q) return true;
      return (
        a.nome.toLowerCase().includes(q) ||
        (a.email ?? "").toLowerCase().includes(q) ||
        (a.cidade_uf ?? "").toLowerCase().includes(q) ||
        (digits.length >= 4 && a.cpf.includes(digits))
      );
    });
  }, [alunos, busca, filtro]);

  const comAtraso = alunos.filter((a) => a.parcelas_atrasadas > 0).length;

  if (alunosQuery.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[74px] w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (alunosQuery.isError) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        Não foi possível carregar os alunos. Tente de novo em instantes.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, CPF, e-mail ou cidade..."
            className="pl-9"
            aria-label="Buscar alunos"
          />
        </div>
        <Select value={filtro} onValueChange={(v) => setFiltro(v as Filtro)}>
          <SelectTrigger className="w-[230px]" aria-label="Filtrar alunos">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(FILTRO_LABEL) as Filtro[]).map((f) => (
              <SelectItem key={f} value={f}>
                {FILTRO_LABEL[f]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {alunos.length} alunos · {comAtraso} com atraso
        </span>
      </div>

      {filtrados.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          Nenhum aluno encontrado. Confira a busca ou o filtro.
        </p>
      ) : (
        <div className="space-y-2">
          {filtrados.slice(0, 200).map((a) => (
            <AlunoCard key={a.cpf} aluno={a} />
          ))}
          {filtrados.length > 200 && (
            <p className="py-3 text-center text-sm text-muted-foreground">
              Mostrando os primeiros 200. Use a busca para achar alguém específico.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function AlunoCard({ aluno }: { aluno: AlunoResumo }) {
  const cursosResumo =
    aluno.cursos.length === 0
      ? "Sem compras registradas"
      : aluno.cursos.slice(0, 2).join(" · ") +
        (aluno.cursos.length > 2 ? ` · +${aluno.cursos.length - 2}` : "");

  return (
    <div className="rounded-lg border border-border/60 bg-card p-4 flex flex-wrap items-center gap-x-6 gap-y-2">
      <div className="min-w-0 flex-1 basis-64">
        <p className="text-base font-medium truncate">{aluno.nome}</p>
        <p className="text-sm text-muted-foreground truncate">
          {[aluno.cidade_uf, aluno.fone || aluno.email].filter(Boolean).join(" · ") ||
            "Sem contato registrado"}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground truncate">
          <GraduationCap className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{cursosResumo}</span>
        </p>
      </div>
      <div className="text-sm text-right">
        <p className="text-muted-foreground">Total pago</p>
        <p className="font-medium">{brl.format(aluno.total_pago)}</p>
      </div>
      {aluno.valor_em_aberto > 0 && (
        <div className="text-sm text-right">
          <p className="text-muted-foreground">Em aberto</p>
          <p className="font-medium">{brl.format(aluno.valor_em_aberto)}</p>
        </div>
      )}
      {aluno.parcelas_atrasadas > 0 ? (
        <SemanticBadge variant="critical">
          {aluno.parcelas_atrasadas} parcela{aluno.parcelas_atrasadas > 1 ? "s" : ""} em atraso
        </SemanticBadge>
      ) : aluno.cursos.length > 0 ? (
        <SemanticBadge variant="success">Em dia</SemanticBadge>
      ) : null}
    </div>
  );
}
