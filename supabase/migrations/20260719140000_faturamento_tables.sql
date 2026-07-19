-- Faturamento Instituto Liz: espelho estruturado da planilha "Faturamento" do Denilson.
-- Fonte da verdade atual e a planilha no Google Drive; estas tabelas sao recarregadas
-- integralmente a cada importacao (wipe + reload via service role).

CREATE TABLE IF NOT EXISTS public.fat_clientes (
  cpf TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT,
  endereco TEXT,
  cidade_uf TEXT,
  fone TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fat_cursos (
  codigo TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  docente TEXT,
  valor_brl NUMERIC,
  valor_eur NUMERIC,
  tipo TEXT NOT NULL DEFAULT 'curso' CHECK (tipo IN ('curso', 'livro'))
);

CREATE TABLE IF NOT EXISTS public.fat_planos (
  id_plano TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  parcelas INTEGER,
  prazo_dias INTEGER,
  taxa TEXT
);

CREATE TABLE IF NOT EXISTS public.fat_parcelas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cpf TEXT,
  nome_cliente TEXT,
  dt_venda DATE,
  id_curso TEXT,
  curso_nome TEXT,
  docente TEXT,
  escola TEXT,
  valor_tabela NUMERIC,
  desconto NUMERIC,
  valor_venda NUMERIC,
  id_plano TEXT,
  plano_nome TEXT,
  prazo INTEGER,
  parcela_num NUMERIC,
  vcto DATE,
  valor_parcela NUMERIC,
  valor_liquido NUMERIC,
  dt_recebimento DATE,
  valor_recebido NUMERIC,
  status TEXT NOT NULL DEFAULT 'aberto',
  atraso_dias INTEGER
);

CREATE INDEX IF NOT EXISTS fat_parcelas_vcto_idx ON public.fat_parcelas (vcto);
CREATE INDEX IF NOT EXISTS fat_parcelas_status_idx ON public.fat_parcelas (status);
CREATE INDEX IF NOT EXISTS fat_parcelas_nome_idx ON public.fat_parcelas (nome_cliente);

CREATE TABLE IF NOT EXISTS public.fat_import_status (
  id TEXT PRIMARY KEY DEFAULT 'system' CHECK (id = 'system'),
  imported_at TIMESTAMPTZ,
  imported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  clientes_count INTEGER,
  parcelas_count INTEGER,
  cursos_count INTEGER,
  planos_count INTEGER,
  last_error TEXT
);

ALTER TABLE public.fat_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fat_cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fat_planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fat_parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fat_import_status ENABLE ROW LEVEL SECURITY;

-- Leitura para usuarios logados; escrita somente via service role (importador).
CREATE POLICY "fat_clientes read" ON public.fat_clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "fat_cursos read" ON public.fat_cursos FOR SELECT TO authenticated USING (true);
CREATE POLICY "fat_planos read" ON public.fat_planos FOR SELECT TO authenticated USING (true);
CREATE POLICY "fat_parcelas read" ON public.fat_parcelas FOR SELECT TO authenticated USING (true);
CREATE POLICY "fat_import_status read" ON public.fat_import_status FOR SELECT TO authenticated USING (true);

CREATE TRIGGER fat_clientes_updated_at
BEFORE UPDATE ON public.fat_clientes
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
