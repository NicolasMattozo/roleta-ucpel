-- ==============================================================================
-- Roleta Interativa • Biomedicina UCPel (Pelotas/RS)
-- Schema PostgreSQL / Supabase com validação de CPF e sorteio atômico
-- ==============================================================================
-- Execute este script completo no SQL Editor do seu projeto Supabase.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Configurações gerais da roleta (linha única id = 1)
CREATE TABLE IF NOT EXISTS public.roulette_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  event_title TEXT NOT NULL DEFAULT 'Roleta Biomedicina UCPel • Pelotas',
  allow_multiple_spins_per_cpf BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.roulette_settings (id, event_title, allow_multiple_spins_per_cpf, is_active)
VALUES (1, 'Roleta Biomedicina UCPel • Pelotas', false, true)
ON CONFLICT (id) DO NOTHING;

-- 2. Participantes (Nome completo + CPF normalizado de 11 dígitos)
CREATE TABLE IF NOT EXISTS public.participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL CHECK (char_length(trim(full_name)) >= 3 AND char_length(full_name) <= 120),
  cpf TEXT NOT NULL UNIQUE CHECK (cpf ~ '^\d{11}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Itens / Prêmios da Roleta (quando ganhos, is_available vira false e somem da roleta)
CREATE TABLE IF NOT EXISTS public.prizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2 AND char_length(name) <= 80),
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Brinde' CHECK (char_length(trim(category)) >= 2 AND char_length(category) <= 40),
  color TEXT CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
  is_available BOOLEAN NOT NULL DEFAULT true,
  claimed_at TIMESTAMPTZ,
  claimed_by_participant_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Histórico de Giros (preserva registro mesmo se o item for restaurado ou editado depois)
CREATE TABLE IF NOT EXISTS public.spins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  prize_id UUID REFERENCES public.prizes(id) ON DELETE SET NULL,
  prize_name TEXT NOT NULL,
  prize_category TEXT NOT NULL DEFAULT 'Brinde',
  prize_color TEXT,
  spun_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas rápidas e chaves estrangeiras
CREATE INDEX IF NOT EXISTS idx_prizes_available_created
  ON public.prizes (is_available, created_at);

CREATE INDEX IF NOT EXISTS idx_prizes_claimed_by
  ON public.prizes (claimed_by_participant_id)
  WHERE claimed_by_participant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_spins_participant_spun_at
  ON public.spins (participant_id, spun_at DESC);

CREATE INDEX IF NOT EXISTS idx_spins_prize_id
  ON public.spins (prize_id)
  WHERE prize_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_spins_spun_at
  ON public.spins (spun_at DESC);

-- ==============================================================================
-- Segurança (RLS - Row Level Security) e Permissões
-- ==============================================================================
-- O acesso aos dados ocorre exclusivamente pelas rotas server-side do Next.js
-- usando SUPABASE_SERVICE_ROLE_KEY (protegendo CPFs completos conforme a LGPD).
ALTER TABLE public.roulette_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spins ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.roulette_settings,
  public.participants,
  public.prizes,
  public.spins
FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.roulette_settings,
  public.participants,
  public.prizes,
  public.spins
TO service_role;

-- ==============================================================================
-- Validador Oficial de Dígitos Verificadores do CPF
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.is_valid_cpf(p_cpf TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_cpf TEXT;
  v_sum INTEGER;
  v_rem INTEGER;
  i INTEGER;
BEGIN
  v_cpf := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');

  IF char_length(v_cpf) <> 11 THEN
    RETURN false;
  END IF;

  -- Rejeita sequências repetidas como 00000000000, 11111111111, etc.
  IF v_cpf ~ '^(\d)\1{10}$' THEN
    RETURN false;
  END IF;

  -- 1º dígito verificador
  v_sum := 0;
  FOR i IN 1..9 LOOP
    v_sum := v_sum + (substr(v_cpf, i, 1)::INTEGER * (11 - i));
  END LOOP;
  v_rem := (v_sum * 10) % 11;
  IF v_rem = 10 THEN
    v_rem := 0;
  END IF;
  IF v_rem <> substr(v_cpf, 10, 1)::INTEGER THEN
    RETURN false;
  END IF;

  -- 2º dígito verificador
  v_sum := 0;
  FOR i IN 1..10 LOOP
    v_sum := v_sum + (substr(v_cpf, i, 1)::INTEGER * (12 - i));
  END LOOP;
  v_rem := (v_sum * 10) % 11;
  IF v_rem = 10 THEN
    v_rem := 0;
  END IF;
  IF v_rem <> substr(v_cpf, 11, 1)::INTEGER THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- ==============================================================================
-- Função RPC Atômica de Sorteio
-- ==============================================================================
-- Valida nome + CPF, verifica regra de giro único por CPF, sorteia um item
-- disponível aleatoriamente, marca o item como indisponível (sumindo da roleta)
-- e registra o participante + resultado em uma única transação segura.
CREATE OR REPLACE FUNCTION public.spin_roulette(
  p_full_name TEXT,
  p_cpf TEXT
)
RETURNS TABLE (
  spin_id UUID,
  prize_id UUID,
  prize_name TEXT,
  prize_description TEXT,
  prize_category TEXT,
  prize_color TEXT,
  participant_name TEXT,
  spun_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_cpf TEXT;
  v_now TIMESTAMPTZ := now();
  v_settings public.roulette_settings%ROWTYPE;
  v_existing_prize TEXT;
  v_participant_id UUID;
  v_prize public.prizes%ROWTYPE;
  v_spin_id UUID;
BEGIN
  v_name := regexp_replace(trim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_cpf := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');

  IF char_length(v_name) < 3 OR char_length(v_name) > 120 THEN
    RAISE EXCEPTION 'INVALID_NAME:Informe seu nome completo (mínimo 3 caracteres).';
  END IF;

  IF NOT public.is_valid_cpf(v_cpf) THEN
    RAISE EXCEPTION 'INVALID_CPF:Informe um CPF válido com 11 dígitos.';
  END IF;

  -- Garante fila determinística para evitar race conditions em cliques simultâneos
  SELECT *
  INTO v_settings
  FROM public.roulette_settings
  WHERE id = 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.roulette_settings (id) VALUES (1)
    RETURNING * INTO v_settings;
  END IF;

  IF NOT v_settings.is_active THEN
    RAISE EXCEPTION 'ROULETTE_INACTIVE:A roleta está pausada pela coordenação no momento.';
  END IF;

  IF NOT v_settings.allow_multiple_spins_per_cpf THEN
    SELECT s.prize_name
    INTO v_existing_prize
    FROM public.participants p
    JOIN public.spins s ON s.participant_id = p.id
    WHERE p.cpf = v_cpf
    ORDER BY s.spun_at DESC
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'ALREADY_SPUN:Este CPF já participou do sorteio e ganhou: %.', v_existing_prize;
    END IF;
  END IF;

  SELECT *
  INTO v_prize
  FROM public.prizes
  WHERE is_available = true
  ORDER BY random()
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_PRIZES_AVAILABLE:Todos os itens da roleta já foram sorteados!';
  END IF;

  INSERT INTO public.participants (full_name, cpf)
  VALUES (v_name, v_cpf)
  ON CONFLICT (cpf)
  DO UPDATE SET full_name = EXCLUDED.full_name
  RETURNING id INTO v_participant_id;

  UPDATE public.prizes
  SET
    is_available = false,
    claimed_at = v_now,
    claimed_by_participant_id = v_participant_id
  WHERE id = v_prize.id;

  INSERT INTO public.spins (participant_id, prize_id, prize_name, prize_category, prize_color, spun_at)
  VALUES (v_participant_id, v_prize.id, v_prize.name, v_prize.category, v_prize.color, v_now)
  RETURNING id INTO v_spin_id;

  RETURN QUERY
  SELECT
    v_spin_id,
    v_prize.id,
    v_prize.name,
    v_prize.description,
    v_prize.category,
    v_prize.color,
    v_name,
    v_now;
END;
$$;

-- Restringe execução da RPC diretamente pelo cliente anônimo (usada pelo servidor Next.js)
REVOKE ALL ON FUNCTION public.spin_roulette(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spin_roulette(TEXT, TEXT) TO service_role;

-- ==============================================================================
-- Dados Iniciais (Seed) • Biomedicina UCPel Pelotas (@biomedicina_ucpel)
-- ==============================================================================
INSERT INTO public.prizes (name, description, category, color)
SELECT * FROM (
  VALUES
    ('Jaleco Bordado UCPel', 'Jaleco branco acinturado com brasão oficial de Biomedicina UCPel.', 'Vestuário', '#205937'),
    ('Kit Estética & Cosmetologia', 'Necessaire exclusiva com séruns demonstrativos da área de Cosmetologia.', 'Estética', '#725387'),
    ('Caneca Térmica Laboratório', 'Caneca personalizada Biomedicina UCPel • Conhecimento & Conexão.', 'Laboratório', '#C9DCD1'),
    ('Ecobag Biomedicina UCPel', 'Sacola ecológica institucional do curso de Biomedicina Pelotas.', 'Institucional', '#4D8742'),
    ('Caderno Científico + Caneta', 'Caderno pautado de práticas laboratoriais + caneta temática.', 'Acadêmico', '#DECBE9'),
    ('Pin Brasão Biomedicina', 'Broche esmaltado com o escudo e microscópio para jaleco.', 'Acessório', '#1E2721'),
    ('Squeeze Inox Campus Saúde', 'Garrafa térmica 500ml com identidade botânica Biomedicina UCPel.', 'Brinde', '#7BA943'),
    ('Visita Guiada Laboratórios', 'Tour exclusivo pelos laboratórios de práticas e Hospital de Simulação.', 'Experiência', '#F4F4EE')
) AS seed(name, description, category, color)
WHERE NOT EXISTS (SELECT 1 FROM public.prizes LIMIT 1);
