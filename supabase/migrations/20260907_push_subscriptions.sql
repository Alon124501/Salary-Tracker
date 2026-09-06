-- Stores browser/OS push subscriptions for Web Push notifications, so
-- backend-created notifications (see routes/notifications.js) can be
-- delivered outside the open tab, not just shown in the in-app feed.
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_subscriptions_admin" ON push_subscriptions FOR ALL USING (auth.role() = 'service_role');
