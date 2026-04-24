
-- App role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Quality records (from "Quality Feb 2026" excel)
CREATE TABLE public.quality_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  day INT,
  month INT,
  year INT,
  shade_no TEXT,
  colour TEXT,
  party_name TEXT,
  denier TEXT,
  sd_unit_no TEXT,
  mc_no TEXT,
  total_shade_pct NUMERIC,
  pt NUMERIC,
  rate_litres_min NUMERIC,
  dispergent_used TEXT,
  type_of_mixer TEXT,
  quality TEXT,
  bf NUMERIC,
  shade_variation NUMERIC,
  record_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quality_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own quality" ON public.quality_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own quality" ON public.quality_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own quality" ON public.quality_records FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own quality" ON public.quality_records FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_quality_user ON public.quality_records(user_id);
CREATE INDEX idx_quality_date ON public.quality_records(record_date);
CREATE INDEX idx_quality_shade ON public.quality_records(shade_no);

-- Recipe submissions
CREATE TABLE public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  shade_name TEXT NOT NULL,
  customer_name TEXT,
  shade_no TEXT,
  denier_filament TEXT,
  cf_only_cf TEXT,
  sdu_no TEXT,
  production_to_be_done_kg NUMERIC,
  batch_volume NUMERIC,
  mc_no TEXT,
  no_of_positions INT,
  cellulose NUMERIC,
  pump_throw NUMERIC,
  pigments JSONB,            -- [{name, percent}]
  total_shade_loading NUMERIC,
  rate_cc_min NUMERIC,
  rate_lit_hr NUMERIC,
  consumption_per_day NUMERIC,
  days_required NUMERIC,
  total_consumption NUMERIC,
  total_batches NUMERIC,
  pigment_conc_full NUMERIC,
  pigment_conc_half NUMERIC,
  water_qty NUMERIC,
  total_qty NUMERIC,
  results JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own recipes" ON public.recipes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own recipes" ON public.recipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own recipes" ON public.recipes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own recipes" ON public.recipes FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_recipes_user ON public.recipes(user_id);

-- Profile auto-create trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
