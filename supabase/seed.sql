-- Seed shared reference data. Run after migrations. Large content (activities, full vocabulary list) is
-- shipped in the app bundle (src/content); this seed covers the small reference tables.

insert into public.achievements (id, title, description) values
  ('first-step',      '{"en":"First step","uz":"Birinchi qadam"}',          '{"en":"Complete your first activity.","uz":"Birinchi mashqni bajaring."}'),
  ('placed',          '{"en":"Starting point","uz":"Boshlang''ich nuqta"}', '{"en":"Finish the placement check.","uz":"Daraja aniqlashni tugating."}'),
  ('four-skills',     '{"en":"All four skills","uz":"To''rt ko''nikma"}',  '{"en":"Practise all four skills.","uz":"To''rt ko''nikmani mashq qiling."}'),
  ('streak-3',        '{"en":"Three days in a row","uz":"Ketma-ket 3 kun"}', '{"en":"3-day streak.","uz":"3 kunlik seriya."}'),
  ('streak-7',        '{"en":"A full week","uz":"To''liq hafta"}',          '{"en":"7-day streak.","uz":"7 kunlik seriya."}'),
  ('first-own-words', '{"en":"In your own words","uz":"O''z so''zlaringiz bilan"}', '{"en":"Use a tracked phrase independently.","uz":"Iborani mustaqil ishlating."}'),
  ('new-context',     '{"en":"New context","uz":"Yangi kontekst"}',        '{"en":"Use one item independently in two activities.","uz":"Bitta iborani ikki mashqda ishlating."}'),
  ('retriever',       '{"en":"Memory worker","uz":"Xotira ustasi"}',       '{"en":"Retrieve 25 items.","uz":"25 ta birlikni eslang."}'),
  ('improver',        '{"en":"Better on the second try","uz":"Ikkinchi urinishda yaxshiroq"}', '{"en":"Improve on a repeated activity.","uz":"Takrorlangan mashqda yaxshilang."}'),
  ('mock-done',       '{"en":"Mock exam finished","uz":"Sinov imtihon tugadi"}', '{"en":"Complete a practice mock exam.","uz":"Sinov imtihonni tugating."}')
on conflict (id) do nothing;

insert into public.daily_missions (id, title, xp) values
  ('read-1',   '{"en":"Finish a reading activity","uz":"Bitta o''qish mashqini tugating"}', 10),
  ('listen-1', '{"en":"Finish a listening activity","uz":"Bitta tinglash mashqini tugating"}', 10),
  ('speak-1',  '{"en":"Short speaking conversation","uz":"Qisqa suhbat"}', 12),
  ('write-1',  '{"en":"Write and get feedback","uz":"Yozing va fikr oling"}', 12),
  ('review-5', '{"en":"Retrieve 5 items","uz":"5 ta birlikni eslang"}', 10),
  ('use-1',    '{"en":"Use a tracked phrase","uz":"Iborani ishlating"}', 15),
  ('any-1',    '{"en":"One 3-minute activity","uz":"3 daqiqalik mashq"}', 10)
on conflict (id) do nothing;
