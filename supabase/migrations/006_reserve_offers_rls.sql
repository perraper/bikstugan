-- Reserve offers: allow any authenticated user to create (triggered on cancellation)
CREATE POLICY "Reserve offers: insert" ON public.reserve_offers
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Reserve offers: allow the offered user to accept (update own)
CREATE POLICY "Reserve offers: update own" ON public.reserve_offers
  FOR UPDATE USING (
    auth.uid() = offered_to_user_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Lottery applications: allow user to update their own (needed when accepting reserve offer → won)
CREATE POLICY "Lottery: update own" ON public.lottery_applications
  FOR UPDATE USING (auth.uid() = user_id);
