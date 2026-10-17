-- Learning content (activities, vocabulary) is shipped in the app bundle, so user rows reference it by id
-- only. Keeping a hard FK would force the content catalog to be mirrored in the database before every sync.
-- learning_activities / vocabulary_items stay available as an optional catalog (e.g. for analytics).

alter table public.activity_attempts drop constraint if exists activity_attempts_activity_id_fkey;
alter table public.user_vocabulary drop constraint if exists user_vocabulary_vocabulary_item_id_fkey;

-- Defensive limits on user-supplied scalar data.
alter table public.activity_attempts add constraint activity_attempts_activity_id_len check (char_length(activity_id) between 1 and 80);
alter table public.user_vocabulary add constraint user_vocabulary_item_id_len check (char_length(vocabulary_item_id) between 1 and 80);
