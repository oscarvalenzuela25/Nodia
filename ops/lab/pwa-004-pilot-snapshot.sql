-- Run against the isolated pilot database and a dedicated pilot account.
-- Required psql variables: pilot_business_id (UUID) and pilot_actor_id (bigint).
-- Use psql -X -qAt -v ON_ERROR_STOP=1 to emit only the JSON receipt.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '2s';

WITH pilot AS (
  SELECT :'pilot_business_id'::uuid AS business_id,
         :'pilot_actor_id'::bigint AS actor_id,
         transaction_timestamp() AS observed_at
), deliveries AS (
  SELECT state, attempt_count,
    CASE WHEN last_reason IN (
      'configuration', 'destination', 'dns', 'expired', 'http_indeterminate',
      'http_rejected', 'installation_changed', 'interrupted_after_arm',
      'recipient_ineligible', 'retry_limit', 'retry_window_elapsed',
      'source_changed', 'subscription', 'subscription_gone', 'timeout', 'transport'
    ) THEN last_reason ELSE 'other' END AS issue
  FROM public.provider_visit_deliveries
  JOIN pilot ON pilot.business_id = provider_visit_deliveries.business_id
    AND pilot.actor_id = provider_visit_deliveries.user_id
), issues AS (
  SELECT state, issue, count(*) AS deliveries
  FROM deliveries
  WHERE state IN ('retry', 'failed', 'expired', 'cancelled', 'unknown')
  GROUP BY state, issue
)
SELECT jsonb_build_object(
  'observed_at', pilot.observed_at,
  'business_preference_enabled', COALESCE((
    SELECT enabled FROM public.provider_visit_notification_preferences
    WHERE business_id = pilot.business_id AND user_id = pilot.actor_id
  ), false),
  'installations', (
    SELECT jsonb_build_object(
      'active', count(*) FILTER (WHERE state = 'active'),
      'revoked', count(*) FILTER (WHERE state = 'revoked'),
      'expired', count(*) FILTER (WHERE state = 'expired')
    ) FROM public.web_push_installations WHERE user_id = pilot.actor_id
  ),
  'occurrences', (
    SELECT jsonb_build_object(
      'due_in_window', count(*) FILTER (
        WHERE status = 'planned' AND send_at <= pilot.observed_at AND pilot.observed_at < expires_at
      ),
      'scheduled_for_later', count(*) FILTER (WHERE status = 'planned' AND send_at > pilot.observed_at),
      'expired', count(*) FILTER (WHERE status = 'expired'),
      'cancelled', count(*) FILTER (WHERE status = 'cancelled')
    ) FROM public.provider_visit_occurrences WHERE business_id = pilot.business_id
  ),
  'deliveries', (
    SELECT jsonb_build_object(
      'armed_attempts', COALESCE(sum(attempt_count), 0),
      'pending', count(*) FILTER (WHERE state = 'pending'),
      'leased', count(*) FILTER (WHERE state = 'leased'),
      'sending', count(*) FILTER (WHERE state = 'sending'),
      'retry', count(*) FILTER (WHERE state = 'retry'),
      'accepted', count(*) FILTER (WHERE state = 'accepted'),
      'failed', count(*) FILTER (WHERE state = 'failed'),
      'expired', count(*) FILTER (WHERE state = 'expired'),
      'cancelled', count(*) FILTER (WHERE state = 'cancelled'),
      'unknown', count(*) FILTER (WHERE state = 'unknown')
    ) FROM deliveries
  ),
  'issues', COALESCE((
    SELECT jsonb_agg(to_jsonb(issues) ORDER BY state, issue) FROM issues
  ), '[]'::jsonb)
) FROM pilot;

COMMIT;
