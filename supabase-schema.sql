-- DigitalVault Supabase setup
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  storage_path text not null unique,
  size bigint not null default 0,
  mime_type text not null default 'application/octet-stream',
  uploader_name text not null default 'Anonymous',
  created_at timestamptz not null default now()
);

alter table public.files enable row level security;

drop policy if exists "Public files are readable" on public.files;
drop policy if exists "Anyone can add file metadata" on public.files;

create policy "Public files are readable"
on public.files for select
using (true);

create policy "Anyone can add file metadata"
on public.files for insert
to anon, authenticated
with check (
  length(trim(uploader_name)) between 1 and 40
  and length(trim(name)) between 1 and 255
  and size >= 0
);

-- Create a PUBLIC bucket named: files
-- In Supabase Dashboard:
-- Storage -> New bucket -> name: files -> Public bucket: ON
-- Set a sensible upload size limit (for example 100 MB).

-- Storage policies for public uploads and downloads.
-- These intentionally do NOT grant public delete access.
drop policy if exists "DigitalVault public uploads" on storage.objects;
drop policy if exists "DigitalVault public reads" on storage.objects;

create policy "DigitalVault public uploads"
on storage.objects for insert
to anon, authenticated
with check (bucket_id = 'files');

create policy "DigitalVault public reads"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'files');
