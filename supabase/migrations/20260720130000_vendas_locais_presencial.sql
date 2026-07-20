-- Fecha a lacuna do plano de ERP nativo: venda presencial registrada no HUB
-- agora entra sozinha na fila de nota fiscal (fat_nfs_fila), sem precisar
-- editar a planilha "Nfs. Dressler" manualmente.

ALTER TABLE public.fat_vendas_locais
  ADD COLUMN IF NOT EXISTS presencial BOOLEAN NOT NULL DEFAULT false;
