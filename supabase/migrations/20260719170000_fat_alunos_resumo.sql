-- Visao agregada por aluno/cliente da planilha de faturamento:
-- junta cadastro (fat_clientes) com o resumo financeiro das parcelas (fat_parcelas).
CREATE OR REPLACE VIEW public.fat_alunos_resumo
WITH (security_invoker = on) AS
SELECT
  c.cpf,
  c.nome,
  c.email,
  c.fone,
  c.cidade_uf,
  COUNT(p.id) FILTER (WHERE p.status = 'aberto' AND p.vcto < CURRENT_DATE) AS parcelas_atrasadas,
  COALESCE(SUM(p.valor_liquido) FILTER (WHERE p.status = 'aberto'), 0) AS valor_em_aberto,
  COALESCE(SUM(p.valor_recebido) FILTER (WHERE p.status = 'pago'), 0) AS total_pago,
  MAX(p.dt_venda) AS ultima_compra,
  ARRAY_REMOVE(ARRAY_AGG(DISTINCT p.curso_nome), NULL) AS cursos
FROM public.fat_clientes c
LEFT JOIN public.fat_parcelas p ON p.cpf = c.cpf
GROUP BY c.cpf, c.nome, c.email, c.fone, c.cidade_uf;

GRANT SELECT ON public.fat_alunos_resumo TO authenticated, service_role;
