-- Correcao de seguranca (scan do Lovable): dados de aluno expostos a qualquer
-- usuario logado.
--
-- As tabelas fat_* foram criadas com "FOR SELECT TO authenticated USING (true)",
-- o que deixa CPF, endereco, telefone, e-mail e todo o historico financeiro de
-- ~1.100 alunos legivel por QUALQUER usuario autenticado do HUB (basta usar a
-- chave publica do Supabase, sem passar pelo app).
--
-- Essas policies nao sao necessarias: 100% das leituras das tabelas fat_*
-- acontecem em faturamento.functions.ts / faturamento.server.ts, que rodam no
-- servidor com supabaseAdmin (service role) e IGNORAM RLS por definicao.
-- Removendo as policies, o RLS volta ao padrao "nega tudo" para o cliente do
-- browser e o app continua funcionando igual.
--
-- Se algum dia uma tela precisar ler fat_* direto do browser, o certo NAO e
-- recriar "USING (true)" e sim criar uma policy por papel (ex: has_role(auth.uid(),
-- 'admin')) ou expor os dados por uma server function.

DROP POLICY IF EXISTS "fat_clientes read" ON public.fat_clientes;
DROP POLICY IF EXISTS "fat_parcelas read" ON public.fat_parcelas;
DROP POLICY IF EXISTS "fat_nfs_fila read" ON public.fat_nfs_fila;
DROP POLICY IF EXISTS "fat_nfs_emitidas read" ON public.fat_nfs_emitidas;
DROP POLICY IF EXISTS "fat_notas_fiscais read" ON public.fat_notas_fiscais;
DROP POLICY IF EXISTS "fat_parcelas_baixas read" ON public.fat_parcelas_baixas;
DROP POLICY IF EXISTS "fat_cursos read" ON public.fat_cursos;
DROP POLICY IF EXISTS "fat_planos read" ON public.fat_planos;
DROP POLICY IF EXISTS "fat_import_status read" ON public.fat_import_status;

-- has_knowledge_admin_role() e SECURITY DEFINER e estava executavel por "anon"
-- (usuario nao autenticado). Nenhuma das outras funcoes SECURITY DEFINER tem
-- esse grant; foi engano. Quem nao esta logado nao tem motivo para chamar.
REVOKE EXECUTE ON FUNCTION public.has_knowledge_admin_role() FROM anon;

-- A view fat_alunos_resumo agrega dados de aluno (CPF, valores, cursos). Ela ja
-- esta com security_invoker=on, entao respeita o RLS das tabelas acima e passa a
-- devolver zero linhas para o browser. O grant para "anon" (nao logado) era
-- desnecessario; removido como defesa em profundidade.
REVOKE ALL ON public.fat_alunos_resumo FROM anon;
