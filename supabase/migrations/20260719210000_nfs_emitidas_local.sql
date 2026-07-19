-- Passo 2 do plano: marcar nota como emitida direto na plataforma.
-- Tabela propria (NAO recarregada na importacao): a marcacao sobrevive ao
-- wipe + reload da fila fat_nfs_fila. A fila exibida filtra por cpf + curso.

CREATE TABLE IF NOT EXISTS public.fat_nfs_emitidas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cpf TEXT,
  nome TEXT,
  curso_nome TEXT,
  valor NUMERIC,
  numero TEXT,
  emitida_em DATE NOT NULL DEFAULT CURRENT_DATE,
  criado_por UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fat_nfs_emitidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fat_nfs_emitidas read" ON public.fat_nfs_emitidas FOR SELECT TO authenticated USING (true);
