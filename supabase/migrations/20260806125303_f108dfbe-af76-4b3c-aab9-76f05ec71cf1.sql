UPDATE public.user_records ur
SET condition = g.grade
FROM (
  SELECT DISTINCT ON (record_id) record_id, grade
  FROM public.grading_history
  WHERE record_id IS NOT NULL AND grade IS NOT NULL AND btrim(grade) <> ''
  ORDER BY record_id, created_at DESC
) g
WHERE ur.id = g.record_id
  AND (ur.condition IS NULL OR btrim(ur.condition) = '')
  AND ur.sealed = false;