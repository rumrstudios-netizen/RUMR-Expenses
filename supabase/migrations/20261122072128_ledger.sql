create table if not exists public.allowed_members(email text primary key check(email=lower(email)));
alter table public.allowed_members enable row level security;
create policy "Members see own membership" on public.allowed_members for select to authenticated using(email=lower((select auth.jwt())->>'email'));
insert into public.allowed_members(email) values ('rumrstudios@gmail.com') on conflict do nothing;

create function public.is_ledger_member() returns boolean language sql stable security invoker set search_path='' as $$ select exists(select 1 from public.allowed_members where email=lower((select auth.jwt())->>'email')); $$;
revoke all on function public.is_ledger_member() from public,anon;
grant execute on function public.is_ledger_member() to authenticated;
create table if not exists public.ledger(owner uuid primary key references auth.users(id),document jsonb not null,revision integer not null default 0 check(revision>=0));
alter table public.ledger enable row level security;
create policy "Owner reads ledger" on public.ledger for select to authenticated using(owner=(select auth.uid()) and public.is_ledger_member());
create policy "Owner initializes ledger" on public.ledger for insert to authenticated with check(owner=(select auth.uid()) and public.is_ledger_member());
create policy "Owner updates ledger" on public.ledger for update to authenticated using(owner=(select auth.uid()) and public.is_ledger_member()) with check(owner=(select auth.uid()) and public.is_ledger_member());
grant select on public.allowed_members to authenticated;
grant select,insert,update on public.ledger to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('receipts','receipts',false,8000000,array['image/png','image/jpeg','image/webp','application/pdf']) on conflict(id) do nothing;
create policy "Members upload own receipts" on storage.objects for insert to authenticated with check(bucket_id='receipts' and (storage.foldername(name))[1]=(select auth.uid())::text and public.is_ledger_member());
create policy "Members read own receipts" on storage.objects for select to authenticated using(bucket_id='receipts' and (storage.foldername(name))[1]=(select auth.uid())::text and public.is_ledger_member());
create policy "Members delete own receipts" on storage.objects for delete to authenticated using(bucket_id='receipts' and (storage.foldername(name))[1]=(select auth.uid())::text and public.is_ledger_member());
