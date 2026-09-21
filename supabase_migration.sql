-- ============================================================
-- ETHNIC WEAR ORDER MANAGEMENT SYSTEM — Supabase SQL Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension (should already be enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT UNIQUE,
  full_name   TEXT,
  role        TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- In case profiles table already existed without username column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. PARTIES (Customers)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parties (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  phone       TEXT,
  address     TEXT,
  gst_number  TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. FABRIC PARTIES (Fabric Suppliers)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fabric_parties (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  phone       TEXT,
  address     TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. ORDER NUMBER SEQUENCE
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT AS $$
BEGIN
  RETURN 'ORD-' || LPAD(nextval('public.order_number_seq')::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.oms_orders (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number                TEXT UNIQUE NOT NULL DEFAULT generate_order_number(),
  party_id                    UUID REFERENCES public.parties(id) ON DELETE SET NULL,
  phone                       TEXT,
  order_date                  DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date               DATE,
  vyapar_order_number         TEXT,
  stitching_measurement_number TEXT,
  notes                       TEXT,
  status                      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'delivered', 'cancelled')),
  created_by                  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. ORDER ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_items (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id              UUID NOT NULL REFERENCES public.oms_orders(id) ON DELETE CASCADE,
  item_type             TEXT NOT NULL CHECK (item_type IN ('kurta', 'koti', 'kurta_koti', 'pant', 'blazer', 'jacket', 'indo_western', 'jodhpuri')),
  fabric_party_id       UUID REFERENCES public.fabric_parties(id) ON DELETE SET NULL,
  fabric_details        TEXT,
  fabric_image_url      TEXT,
  quantity              INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  special_instructions  TEXT,
  notes                 TEXT,
  position              INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. ITEM PROGRESS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.item_progress (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id                 UUID NOT NULL UNIQUE REFERENCES public.order_items(id) ON DELETE CASCADE,
  -- Fabric Stage
  fabric_status           TEXT NOT NULL DEFAULT 'pending' CHECK (fabric_status IN ('pending', 'in_progress', 'completed')),
  fabric_started_at       TIMESTAMPTZ,
  fabric_completed_at     TIMESTAMPTZ,
  -- Work Stage
  work_status             TEXT NOT NULL DEFAULT 'pending' CHECK (work_status IN ('pending', 'in_progress', 'completed')),
  work_started_at         TIMESTAMPTZ,
  work_completed_at       TIMESTAMPTZ,
  -- Stitching Stage
  stitching_status        TEXT NOT NULL DEFAULT 'pending' CHECK (stitching_status IN ('pending', 'in_progress', 'completed')),
  stitching_started_at    TIMESTAMPTZ,
  stitching_completed_at  TIMESTAMPTZ,
  -- Delivery Stage
  delivery_status         TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'in_progress', 'completed')),
  delivery_started_at     TIMESTAMPTZ,
  delivery_completed_at   TIMESTAMPTZ,
  -- Meta
  updated_by              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create progress row when item is created
CREATE OR REPLACE FUNCTION public.handle_new_order_item()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.item_progress (item_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_order_item_created ON public.order_items;
CREATE TRIGGER on_order_item_created
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_order_item();

-- ============================================================
-- 8. ITEM PROGRESS HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.item_progress_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id     UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  stage       TEXT NOT NULL CHECK (stage IN ('fabric', 'work', 'stitching', 'delivery')),
  old_status  TEXT,
  new_status  TEXT NOT NULL,
  changed_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 9. ATTACHMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attachments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id      UUID NOT NULL REFERENCES public.oms_orders(id) ON DELETE CASCADE,
  item_id       UUID REFERENCES public.order_items(id) ON DELETE CASCADE,
  file_url      TEXT NOT NULL,
  file_name     TEXT,
  file_type     TEXT,
  uploaded_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 10. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_oms_orders_party_id       ON public.oms_orders(party_id);
CREATE INDEX IF NOT EXISTS idx_oms_orders_delivery_date  ON public.oms_orders(delivery_date);
CREATE INDEX IF NOT EXISTS idx_oms_orders_order_date     ON public.oms_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_oms_orders_status         ON public.oms_orders(status);
CREATE INDEX IF NOT EXISTS idx_oms_orders_order_number   ON public.oms_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id      ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_item_progress_item_id     ON public.item_progress(item_id);
CREATE INDEX IF NOT EXISTS idx_progress_history_item_id  ON public.item_progress_history(item_id);

-- ============================================================
-- 11. updated_at TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_parties
  BEFORE UPDATE ON public.parties
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_fabric_parties
  BEFORE UPDATE ON public.fabric_parties
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_oms_orders
  BEFORE UPDATE ON public.oms_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_order_items
  BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 12. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parties           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabric_parties    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oms_orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_progress     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_progress_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments       ENABLE ROW LEVEL SECURITY;

-- profiles: users can read all, update own
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- parties: authenticated users full access
CREATE POLICY "parties_all"         ON public.parties         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "fabric_parties_all"  ON public.fabric_parties  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "oms_orders_all"      ON public.oms_orders      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "order_items_all"     ON public.order_items     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "item_progress_all"   ON public.item_progress   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "progress_hist_all"   ON public.item_progress_history FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "attachments_all"     ON public.attachments     FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 13. STORAGE BUCKET (run separately if needed)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('fabric-images', 'fabric-images', true);
-- CREATE POLICY "fabric_images_read" ON storage.objects FOR SELECT USING (bucket_id = 'fabric-images');
-- CREATE POLICY "fabric_images_write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fabric-images');
-- CREATE POLICY "fabric_images_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'fabric-images');
