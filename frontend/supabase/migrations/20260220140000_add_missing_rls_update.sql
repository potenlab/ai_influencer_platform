-- content_plans: users can update own plans
CREATE POLICY "Users can update own content plans"
  ON public.content_plans FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- media: users can update own media
CREATE POLICY "Users can update own media"
  ON public.media FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
