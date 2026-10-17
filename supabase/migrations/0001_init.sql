-- LinguaQuest AI – initial schema. Apply with `supabase db push` or paste into the SQL editor.
-- Every user-owned table has Row Level Security enabled and an owner-only policy.

-- gen_random_uuid() is built into PostgreSQL 13+ (no extension needed).

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  preferred_language text not null default 'uz' check (preferred_language in ('uz', 'en')),
  learning_goal text not null default 'general',
  available_study_minutes int not null default 10 check (available_study_minutes between 3 and 120),
  exam_target text not null default 'none',
  correction_intensity text not null default 'balanced' check (correction_intensity in ('gentle', 'balanced', 'detailed')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile row when a user signs up.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ------------------------------------------------------------ skill progress
create table public.skill_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  skill text not null check (skill in ('speaking','listening','reading','writing','vocabulary','grammar')),
  estimated_level text not null default 'A0' check (estimated_level in ('A0','A1','A2','B1','B2')),
  theta numeric not null default 0.8,
  evidence int not null default 0 check (evidence >= 0),
  confidence numeric not null default 0 check (confidence between 0 and 1),
  updated_at timestamptz not null default now(),
  primary key (user_id, skill)
);

create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  assessment_type text not null check (assessment_type in ('placement','mock-exam')),
  responses jsonb not null default '[]',
  score numeric,
  rubric_version text not null,
  created_at timestamptz not null default now()
);
create index on public.assessment_attempts (user_id, created_at desc);

-- ------------------------------------------------- content (readable by all)
create table public.learning_activities (
  id text primary key,
  skill text not null,
  level text not null check (level in ('A0','A1','A2','B1','B2')),
  activity_type text not null,
  content jsonb not null,
  answer_key jsonb,
  rubric jsonb,
  metadata jsonb not null default '{}'
);
create index on public.learning_activities (skill, level);

create table public.activity_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_id text not null references public.learning_activities (id),
  response jsonb,
  feedback jsonb,
  score numeric check (score between 0 and 1),
  duration_seconds int not null default 0 check (duration_seconds >= 0),
  created_at timestamptz not null default now()
);
create index on public.activity_attempts (user_id, created_at desc);

create table public.vocabulary_items (
  id text primary key,
  lemma text not null,
  phrase text,
  forms text[] not null default '{}',
  meaning_uz text not null,
  example text not null,
  collocations text[] not null default '{}',
  level text not null check (level in ('A0','A1','A2','B1','B2'))
);

create table public.user_vocabulary (
  user_id uuid not null references auth.users (id) on delete cascade,
  vocabulary_item_id text not null references public.vocabulary_items (id),
  recognition_state text not null default 'encountered' check (recognition_state in ('unseen','encountered','recognized','recalled')),
  productive_state text not null default 'none' check (productive_state in ('none','assisted','independent','multi_context')),
  exposure_count int not null default 0,
  successful_retrieval_count int not null default 0,
  independent_use_count int not null default 0,
  contexts text[] not null default '{}',
  interval_days numeric not null default 0,
  ease numeric not null default 2.3,
  lapses int not null default 0,
  last_seen_at timestamptz,
  last_success_at timestamptz,
  next_review_at timestamptz,
  primary key (user_id, vocabulary_item_id)
);
create index on public.user_vocabulary (user_id, next_review_at);

create table public.learning_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  activity_summary jsonb not null default '{}'
);

create table public.achievements (
  id text primary key,
  title jsonb not null,
  description jsonb not null
);
create table public.user_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null references public.achievements (id),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table public.daily_missions (
  id text primary key,
  title jsonb not null,
  xp int not null check (xp >= 0)
);
create table public.user_missions (
  user_id uuid not null references auth.users (id) on delete cascade,
  mission_id text not null references public.daily_missions (id),
  day date not null,
  completed_at timestamptz,
  primary key (user_id, mission_id, day)
);

-- MVP sync: the web app stores its validated learner state as one JSON snapshot per user.
-- The normalised tables above are the target model for server-side analytics (see README, "Next steps").
create table public.learner_snapshots (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.skill_progress enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.activity_attempts enable row level security;
alter table public.user_vocabulary enable row level security;
alter table public.learning_sessions enable row level security;
alter table public.user_achievements enable row level security;
alter table public.user_missions enable row level security;
alter table public.learner_snapshots enable row level security;
alter table public.learning_activities enable row level security;
alter table public.vocabulary_items enable row level security;
alter table public.achievements enable row level security;
alter table public.daily_missions enable row level security;

create policy "profiles owner" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['skill_progress','assessment_attempts','activity_attempts','user_vocabulary','learning_sessions','user_achievements','user_missions','learner_snapshots']
  loop
    execute format('create policy "%1$s owner" on public.%1$I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Shared content: readable by signed-in users, writable only with the service role (no policy = no access).
create policy "activities read" on public.learning_activities for select to authenticated using (true);
create policy "vocab read" on public.vocabulary_items for select to authenticated using (true);
create policy "achievements read" on public.achievements for select to authenticated using (true);
create policy "missions read" on public.daily_missions for select to authenticated using (true);
