-- Fase 4 do plano de ERP nativo: integração com a Conta Azul aposentada.
-- O Instituto não usa o Conta Azul (banco vazio, nunca cadastraram nada lá);
-- todas as funções foram recriadas nativamente no HUB (Fases 1-3).
DROP TABLE IF EXISTS public.conta_azul_oauth_tokens;
