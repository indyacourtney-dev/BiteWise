-- backend/supabase/migrations/20260928000000_profile_photos.sql
--
-- Profile pictures.
--   * profiles.avatar_url   public URL of the user's current photo
--   * storage bucket "avatars" (public read, 2 MB max, images only)
--   * each user may only write inside their own folder: avatars/<user id>/...
--
-- Account deletion is handled by the Edge Function
-- backend/supabase/functions/delete-account (it needs admin rights, which
-- must never be in the app). Deleting a user cascades to their profile,
-- favorites, pantry, preferences, room memberships and messages; recipes
-- they shared stay, without their name.

alter table public.profiles add column if not exists avatar_url text;

-- Storage lives in its own schema; skip quietly where it doesn't exist
-- (plain Postgres test databases).
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not found - skipping avatar bucket setup';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
  on conflict (id) do update
    set public = true,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists "avatar images are public" on storage.objects';
  execute $p$create policy "avatar images are public" on storage.objects
    for select using (bucket_id = 'avatars')$p$;

  execute 'drop policy if exists "users upload their own avatar" on storage.objects';
  execute $p$create policy "users upload their own avatar" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text))$p$;

  execute 'drop policy if exists "users replace their own avatar" on storage.objects';
  execute $p$create policy "users replace their own avatar" on storage.objects
    for update to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text))
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text))$p$;

  execute 'drop policy if exists "users delete their own avatar" on storage.objects';
  execute $p$create policy "users delete their own avatar" on storage.objects
    for delete to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text))$p$;
end $$;
