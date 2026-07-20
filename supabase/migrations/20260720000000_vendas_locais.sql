-- Fase 1 do ERP nativo: registrar venda nova e cadastrar aluno direto no HUB,
-- sem depender da planilha. Como a importacao da planilha e wipe+reload das
-- tabelas fat_clientes/fat_parcelas, o que e criado aqui no HUB precisa viver
-- em tabelas proprias (nao apagadas pela importacao) e ser reaplicado depois
-- de cada import — mesmo padrao ja usado em fat_parcelas_baixas e fat_nfs_emitidas.

CREATE TABLE IF NOT EXISTS public.fat_clientes_locais (
  cpf TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  endereco TEXT,
  cidade_uf TEXT,
  fone TEXT,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fat_vendas_locais (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cpf TEXT NOT NULL,
  nome_cliente TEXT NOT NULL,
  id_curso TEXT,
  curso_nome TEXT NOT NULL,
  id_plano TEXT,
  plano_nome TEXT NOT NULL,
  valor_tabela NUMERIC,
  desconto NUMERIC,
  valor_venda NUMERIC NOT NULL,
  num_parcelas INTEGER NOT NULL,
  prazo_dias INTEGER,
  dt_venda DATE NOT NULL,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fat_parcelas_locais (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  venda_id BIGINT NOT NULL REFERENCES public.fat_vendas_locais(id) ON DELETE CASCADE,
  parcela_num INTEGER NOT NULL,
  vcto DATE NOT NULL,
  valor_parcela NUMERIC NOT NULL
);

CREATE INDEX IF NOT EXISTS fat_parcelas_locais_venda_idx ON public.fat_parcelas_locais (venda_id);

ALTER TABLE public.fat_clientes_locais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fat_vendas_locais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fat_parcelas_locais ENABLE ROW LEVEL SECURITY;

-- Leitura para logados; escrita somente via service role (server functions).
CREATE POLICY "fat_clientes_locais read" ON public.fat_clientes_locais FOR SELECT TO authenticated USING (true);
CREATE POLICY "fat_vendas_locais read" ON public.fat_vendas_locais FOR SELECT TO authenticated USING (true);
CREATE POLICY "fat_parcelas_locais read" ON public.fat_parcelas_locais FOR SELECT TO authenticated USING (true);
