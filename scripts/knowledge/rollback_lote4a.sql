-- ==========================================
-- ROLLBACK LOTE 4A: FUNDAÇÃO DE ASSETS
-- ==========================================

-- AVISO: O bucket só pode ser excluído se estiver vazio.
-- Se houver arquivos no bucket 'knowledge-assets', a exclusão falhará por segurança.
-- Para forçar, você teria que apagar os objetos fisicamente primeiro.

BEGIN;

-- 1. Remover policies do Storage (storage.objects)
DROP POLICY IF EXISTS "Private Bucket Access Admin/Editor" ON storage.objects;
DROP POLICY IF EXISTS "Private Bucket Upload Admin/Editor" ON storage.objects;
DROP POLICY IF EXISTS "Private Bucket Delete Admin" ON storage.objects;

-- 2. Remover policies das tabelas (public)
DROP POLICY IF EXISTS "Assets are viewable by everyone if public" ON public.knowledge_assets;
DROP POLICY IF EXISTS "Assets internal are viewable by authorized roles" ON public.knowledge_assets;
DROP POLICY IF EXISTS "Revisions viewable by admin/editors" ON public.knowledge_asset_revisions;

-- 3. Remover índices
DROP INDEX IF EXISTS public.knowledge_assets_one_primary_per_category;

-- 4. Remover tabela de revisões (depende de knowledge_assets)
DROP TABLE IF EXISTS public.knowledge_asset_revisions CASCADE;

-- 5. Remover tabela de assets
DROP TABLE IF EXISTS public.knowledge_assets CASCADE;

-- 6. Remover o bucket (Falhará de forma segura se não estiver vazio)
DELETE FROM storage.buckets WHERE id = 'knowledge-assets';

COMMIT;
