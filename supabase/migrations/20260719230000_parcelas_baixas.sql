-- Fase B do plano: dar baixa em parcela direto na plataforma (HUB como fonte da verdade).
-- Tabela propria (NAO recarregada na importacao): a baixa sobrevive ao wipe + reload
-- de fat_parcelas. runFaturamentoImport reaplica estas baixas por assinatura
-- (cpf + vcto + valor_parcela + parcela_num) depois de recarregar as parcelas.

CREATE TABLE IF NOT EXISTS public.fat_parcelas_baixas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cpf TEXT,
  vcto DATE,
  valor_parcela NUMERIC,
  parcela_num INTEGER,
  curso_nome TEXT,
  nome_cliente TEXT,
  dt_recebimento DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_recebido NUMERIC,
  criado_por UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fat_parcelas_baixas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fat_parcelas_baixas read" ON public.fat_parcelas_baixas FOR SELECT TO authenticated USING (true);
