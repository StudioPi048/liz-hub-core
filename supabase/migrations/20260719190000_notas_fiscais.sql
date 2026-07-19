-- Fase 2 do faturamento: fila de notas a emitir (aba "Nfs. Dressler" da planilha)
-- e historico de notas emitidas (aba "Nota Fiscal"). Recarregadas a cada importacao.

CREATE TABLE IF NOT EXISTS public.fat_notas_fiscais (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  data DATE,
  cliente TEXT,
  numero TEXT,
  valor NUMERIC
);

CREATE TABLE IF NOT EXISTS public.fat_nfs_fila (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cpf TEXT,
  nome TEXT,
  email TEXT,
  endereco TEXT,
  cidade_uf TEXT,
  fone TEXT,
  id_curso TEXT,
  curso_nome TEXT,
  valor_venda NUMERIC,
  id_plano TEXT,
  plano_nome TEXT
);

ALTER TABLE public.fat_notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fat_nfs_fila ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fat_notas_fiscais read" ON public.fat_notas_fiscais FOR SELECT TO authenticated USING (true);
CREATE POLICY "fat_nfs_fila read" ON public.fat_nfs_fila FOR SELECT TO authenticated USING (true);
