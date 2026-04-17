insert into storage.buckets (id, name, public) values ('email-assets', 'email-assets', true) on conflict (id) do nothing;

create policy "email_assets_public_read" on storage.objects for select using (bucket_id = 'email-assets');