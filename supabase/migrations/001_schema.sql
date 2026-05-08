-- ============================================
-- BIK-stugan Bokningssystem — Databasschema
-- ============================================

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  member_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Weeks table — one row per bookable week
CREATE TABLE public.weeks (
  year INTEGER NOT NULL,
  week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 53),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'lottery', 'booked')),
  booked_by_user_id UUID REFERENCES public.users(id),
  price INTEGER NOT NULL DEFAULT 2000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (year, week_number)
);

-- Bookings table — immutable log of all bookings
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  year INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  price INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ
);

-- Lottery applications
CREATE TABLE public.lottery_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  year INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'reserve', 'lost')),
  reserve_rank INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, year, week_number)
);

-- Electricity readings (optional, for history)
CREATE TABLE public.electricity_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  year INTEGER NOT NULL,
  week_number INTEGER NOT NULL,
  start_kwh NUMERIC NOT NULL,
  end_kwh NUMERIC NOT NULL,
  cost NUMERIC GENERATED ALWAYS AS ((end_kwh - start_kwh) * 2.50) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lottery_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.electricity_readings ENABLE ROW LEVEL SECURITY;

-- Users: everyone can read (for neighbor coordination), only own profile editable
CREATE POLICY "Users: read all" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users: insert own" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users: update own" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Weeks: everyone can read, admins can modify, members can book available weeks
CREATE POLICY "Weeks: read all" ON public.weeks FOR SELECT USING (true);
CREATE POLICY "Weeks: admin manage" ON public.weeks FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Weeks: member book" ON public.weeks FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);
CREATE POLICY "Weeks: member update own booking" ON public.weeks FOR UPDATE USING (
  auth.uid() IS NOT NULL
);

-- Bookings: users see own, admins see all
CREATE POLICY "Bookings: read own" ON public.bookings FOR SELECT USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Bookings: insert own" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Bookings: update own" ON public.bookings FOR UPDATE USING (auth.uid() = user_id);

-- Lottery: users see own, admins see all
CREATE POLICY "Lottery: read own or admin" ON public.lottery_applications FOR SELECT USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Lottery: insert own" ON public.lottery_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Lottery: admin update" ON public.lottery_applications FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Electricity: users see own
CREATE POLICY "Electricity: read own" ON public.electricity_readings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Electricity: insert own" ON public.electricity_readings FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX idx_weeks_year ON public.weeks(year);
CREATE INDEX idx_bookings_user ON public.bookings(user_id);
CREATE INDEX idx_lottery_user_year ON public.lottery_applications(user_id, year);
CREATE INDEX idx_lottery_week ON public.lottery_applications(year, week_number);

-- ============================================
-- Updated_at trigger for weeks
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER weeks_updated_at
  BEFORE UPDATE ON public.weeks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
