ALTER TABLE public.people ADD COLUMN avatar_path text, ADD COLUMN instagram text;
CREATE POLICY "members read avatars" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND public.is_workspace_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY "members upload avatars" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND public.is_workspace_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY "members update avatars" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND public.is_workspace_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY "members delete avatars" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND public.is_workspace_member(((storage.foldername(name))[1])::uuid));