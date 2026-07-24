-- Fase 2 do ERP nativo: contas a pagar dentro do HUB, substituindo a leitura
-- da API do Conta Azul (que aponta para um banco vazio). Uma tabela só:
-- fornecedor e texto livre e as categorias sao uma lista fixa no codigo
-- (aluguel, salarios, marketing, impostos, docentes, outros) — sem tabelas
-- fin_fornecedores/fin_categorias_despesa enquanto a lista nao precisar
-- crescer pelo proprio Denilson.

CREATE TABLE IF NOT EXISTS public.fin_contas_pagar (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  descricao TEXT NOT NULL,
  fornecedor TEXT,
  categoria TEXT NOT NULL DEFAULT 'outros',
  vencimento DATE NOT NULL,
  valor NUMERIC NOT NULL,
  pago BOOLEAN NOT NULL DEFAULT false,
  pago_em DATE,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fin_contas_pagar_vencimento_idx
  ON public.fin_contas_pagar (vencimento);

-- Mesmo padrao das tabelas fat_*: RLS ligado, zero policies. Leitura e escrita
-- so via server function com service role (ignora RLS). Nunca USING (true).
ALTER TABLE public.fin_contas_pagar ENABLE ROW LEVEL SECURITY;
