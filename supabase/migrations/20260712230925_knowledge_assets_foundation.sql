-- ==========================================
-- LOTE 4A: FUNDAÇÃO DE ASSETS
-- Tabela de Assets, Revisões, Storage e RLS
-- ==========================================

-- 1. Criação do bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-assets', 'knowledge-assets', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Tabela de Assets
CREATE TABLE public.knowledge_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  knowledge_node_id UUID NOT NULL
    REFERENCES public.knowledge_nodes(id)
    ON DELETE RESTRICT, -- Alterado de CASCADE para RESTRICT conforme diretriz patrimonial

  stable_id TEXT NOT NULL CHECK (btrim(stable_id) <> ''),

  asset_type TEXT NOT NULL
    CHECK (
      asset_type IN (
        'document',
        'image',
        'video',
        'audio',
        'archive',
        'link',
        'dataset',
        'other'
      )
    ),

  asset_category TEXT NOT NULL CHECK (btrim(asset_category) <> ''),

  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  description TEXT,
  alt_text TEXT,

  storage_provider TEXT NOT NULL
    CHECK (
      storage_provider IN (
        'supabase',
        'google_drive',
        'hotmart',
        'youtube',
        'vimeo',
        'external_url',
        'repository'
      )
    ),

  storage_bucket TEXT,
  storage_path TEXT,
  external_url TEXT,

  -- Restrições de localização do ativo
  CHECK (
    (
      storage_provider = 'supabase'
      AND storage_bucket IS NOT NULL
      AND storage_path IS NOT NULL
      AND external_url IS NULL
    )
    OR
    (
      storage_provider = 'repository'
      AND source_reference IS NOT NULL
      AND external_url IS NULL
    )
    OR
    (
      storage_provider NOT IN ('supabase', 'repository')
      AND external_url IS NOT NULL
      AND storage_bucket IS NULL
      AND storage_path IS NULL
    )
  ),

  original_filename TEXT,
  mime_type TEXT,
  file_extension TEXT,
  size_bytes BIGINT CHECK (size_bytes IS NULL OR size_bytes >= 0),
  content_hash TEXT,

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (
      status IN (
        'draft',
        'in_review',
        'approved',
        'archived',
        'unavailable'
      )
    ),

  visibility TEXT NOT NULL DEFAULT 'internal'
    CHECK (
      visibility IN (
        'public',
        'internal',
        'restricted',
        'private'
      )
    ),

  rights_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (
      rights_status IN (
        'owned',
        'licensed',
        'authorized',
        'public_domain',
        'external_reference',
        'unknown',
        'restricted'
      )
    ),

  -- Restrições cruzadas de rights e visibility
  CHECK (
    NOT (rights_status = 'unknown' AND visibility = 'public')
  ),
  CHECK (
    NOT (rights_status = 'restricted' AND visibility NOT IN ('restricted', 'private'))
  ),

  rights_holder TEXT,
  usage_notes TEXT,
  license_reference TEXT,

  language TEXT DEFAULT 'pt-BR',

  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),

  source_type TEXT NOT NULL CHECK (btrim(source_type) <> ''),
  source_reference TEXT,

  metadata JSONB NOT NULL DEFAULT '{}',

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  archived_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,

  UNIQUE (knowledge_node_id, stable_id)
);

-- Índice único para apenas um ativo principal por categoria (ignora arquivados)
CREATE UNIQUE INDEX knowledge_assets_one_primary_per_category
ON public.knowledge_assets (knowledge_node_id, asset_category)
WHERE is_primary = true AND archived_at IS NULL;

-- 3. Tabela de Revisões de Assets
CREATE TABLE public.knowledge_asset_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  knowledge_asset_id UUID NOT NULL
    REFERENCES public.knowledge_assets(id)
    ON DELETE CASCADE,

  knowledge_node_id UUID NOT NULL
    REFERENCES public.knowledge_nodes(id)
    ON DELETE CASCADE,

  stable_id TEXT NOT NULL,

  proposed_name TEXT NOT NULL,
  proposed_description TEXT,
  proposed_alt_text TEXT,

  proposed_asset_type TEXT NOT NULL,
  proposed_asset_category TEXT NOT NULL,
  proposed_storage_provider TEXT NOT NULL,

  proposed_storage_bucket TEXT,
  proposed_storage_path TEXT,
  proposed_external_url TEXT,

  proposed_original_filename TEXT,
  proposed_mime_type TEXT,
  proposed_file_extension TEXT,
  proposed_size_bytes BIGINT,
  proposed_content_hash TEXT,

  proposed_visibility TEXT NOT NULL,
  proposed_rights_status TEXT NOT NULL,
  proposed_rights_holder TEXT,
  proposed_usage_notes TEXT,
  proposed_license_reference TEXT,

  proposed_metadata JSONB NOT NULL DEFAULT '{}',

  previous_content_hash TEXT,
  proposed_manifest_hash TEXT NOT NULL,

  reason TEXT NOT NULL DEFAULT 'repository_manifest_changed',

  status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (
      status IN (
        'proposed',
        'in_review',
        'approved',
        'rejected',
        'superseded'
      )
    ),

  source_reference TEXT,
  indexation_run_id TEXT,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,

  UNIQUE (knowledge_asset_id, proposed_manifest_hash)
);

-- 4. RLS para as Tabelas
ALTER TABLE public.knowledge_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_asset_revisions ENABLE ROW LEVEL SECURITY;

-- Assets RLS: Permitir leitura apenas para roles administrativos/editores para internal
-- Assumindo que auth.users roles ou app_metadata determinam isso futuramente.
-- No momento, usando regra restrita: apenas service role consegue inserir.
-- Autenticados comuns só veem public (no caso, não criamos public assets agora, mas é bom prever)

CREATE POLICY "Assets are viewable by everyone if public" 
ON public.knowledge_assets FOR SELECT 
TO authenticated
USING (visibility = 'public');

CREATE POLICY "Assets internal are viewable by authorized roles" 
ON public.knowledge_assets FOR SELECT 
TO authenticated
USING (visibility = 'internal' AND (auth.jwt() ->> 'role' IN ('admin', 'editor')));

CREATE POLICY "Revisions viewable by admin/editors" 
ON public.knowledge_asset_revisions FOR SELECT 
TO authenticated
USING (auth.jwt() ->> 'role' IN ('admin', 'editor'));

-- 5. RLS para Storage (bucket knowledge-assets)
-- Restringe acesso ao bucket
CREATE POLICY "Private Bucket Access Admin/Editor"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'knowledge-assets' AND
  (auth.jwt() ->> 'role' IN ('admin', 'editor'))
);

CREATE POLICY "Private Bucket Upload Admin/Editor"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'knowledge-assets' AND
  (auth.jwt() ->> 'role' IN ('admin', 'editor'))
);

CREATE POLICY "Private Bucket Delete Admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'knowledge-assets' AND
  (auth.jwt() ->> 'role' = 'admin')
);