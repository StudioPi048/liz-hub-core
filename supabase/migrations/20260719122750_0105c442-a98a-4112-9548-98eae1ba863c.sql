CREATE TABLE IF NOT EXISTS public.conta_azul_oauth_tokens (
  id TEXT PRIMARY KEY DEFAULT 'system' CHECK (id = 'system'),
  connected_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  conta_azul_identity JSONB,
  access_token_ciphertext TEXT,
  refresh_token_ciphertext TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  scope TEXT,
  token_type TEXT,
  status TEXT NOT NULL DEFAULT 'connected'
    CHECK (status IN ('connected', 'needs_reconnect', 'error')),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.conta_azul_oauth_tokens TO service_role;
REVOKE ALL ON public.conta_azul_oauth_tokens FROM anon, authenticated;

ALTER TABLE public.conta_azul_oauth_tokens ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS conta_azul_tokens_updated_at ON public.conta_azul_oauth_tokens;
CREATE TRIGGER conta_azul_tokens_updated_at
BEFORE UPDATE ON public.conta_azul_oauth_tokens
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();