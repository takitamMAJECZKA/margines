create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  email text not null unique,
  created_at timestamptz not null default now(),
  constraint profiles_username_length check (char_length(username) between 3 and 32),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]+$')
);

create table public.dictionaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  source_language text not null check (source_language in ('es','en','de','fr','pl')),
  target_language text not null check (target_language in ('es','en','de','fr','pl')),
  is_native boolean not null default false,
  color text not null check (color in ('amber','emerald','sky','rose','violet','stone')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, source_language),
  unique (user_id, name),
  check ((is_native and source_language = 'pl' and target_language = 'pl') or (not is_native and source_language <> 'pl' and target_language = 'pl'))
);

create table public.words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dictionary_id uuid not null,
  original_word text not null,
  normalized_word text not null,
  translation text not null default '',
  example_sentence text not null default '',
  example_translation text not null default '',
  example_source text not null default '',
  example_source_url text not null default '',
  example_attribution text not null default '',
  example_type text not null default 'manual' check (example_type in ('authentic','ai','manual')),
  review_count integer not null default 0 check (review_count >= 0),
  last_reviewed_at bigint,
  last_review_known boolean,
  knowledge_score smallint not null default 0 check (knowledge_score between 0 and 5),
  last_appeared_at bigint,
  created_at bigint not null,
  updated_at bigint not null,
  unique (id, dictionary_id, user_id),
  unique (dictionary_id, normalized_word),
  foreign key (dictionary_id, user_id) references public.dictionaries(id, user_id) on delete cascade
);

create index words_user_dictionary_created_idx on public.words(user_id, dictionary_id, created_at desc);

create table public.word_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dictionary_id uuid not null,
  name text not null,
  created_at bigint not null,
  updated_at bigint not null,
  unique (id, dictionary_id, user_id),
  unique (dictionary_id, name),
  foreign key (dictionary_id, user_id) references public.dictionaries(id, user_id) on delete cascade
);

create table public.set_words (
  set_id uuid not null,
  word_id uuid not null,
  dictionary_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at bigint not null,
  primary key (set_id, word_id),
  foreign key (set_id, dictionary_id, user_id) references public.word_sets(id, dictionary_id, user_id) on delete cascade,
  foreign key (word_id, dictionary_id, user_id) references public.words(id, dictionary_id, user_id) on delete cascade
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('system','light','dark')),
  default_word_input_language text not null default 'dictionary' check (default_word_input_language in ('dictionary','polish')),
  updated_at timestamptz not null default now()
);

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_username text;
begin
  chosen_username := lower(trim(coalesce(new.raw_user_meta_data ->> 'username', 'user_' || substr(replace(new.id::text, '-', ''), 1, 12))));
  if char_length(chosen_username) < 3 or char_length(chosen_username) > 32 or chosen_username !~ '^[a-z0-9_]+$' then
    raise exception 'Invalid username';
  end if;
  insert into public.profiles(id, username, email) values (new.id, chosen_username, new.email);
  insert into public.user_preferences(user_id) values (new.id);
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create function private.handle_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;
revoke all on function private.handle_user_email_update() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create trigger on_auth_user_email_updated
after update of email on auth.users
for each row when (old.email is distinct from new.email)
execute function private.handle_user_email_update();

alter table public.profiles enable row level security;
alter table public.dictionaries enable row level security;
alter table public.words enable row level security;
alter table public.word_sets enable row level security;
alter table public.set_words enable row level security;
alter table public.user_preferences enable row level security;

create policy "Profiles are private to their owner" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Users manage their dictionaries" on public.dictionaries
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their words" on public.words
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their sets" on public.word_sets
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their set memberships" on public.set_words
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their preferences" on public.user_preferences
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select on public.profiles to authenticated;
grant select on public.profiles to service_role;
grant select, insert, update, delete on public.dictionaries, public.words, public.word_sets, public.set_words, public.user_preferences to authenticated;

create index words_dictionary_owner_idx on public.words(dictionary_id, user_id);
create index word_sets_user_dictionary_idx on public.word_sets(user_id, dictionary_id);
create index word_sets_dictionary_owner_idx on public.word_sets(dictionary_id, user_id);
create index set_words_user_dictionary_idx on public.set_words(user_id, dictionary_id);
create index set_words_set_owner_idx on public.set_words(set_id, dictionary_id, user_id);
create index set_words_word_owner_idx on public.set_words(word_id, dictionary_id, user_id);
