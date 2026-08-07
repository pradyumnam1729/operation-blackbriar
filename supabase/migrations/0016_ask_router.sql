-- 0016: seed the ask-router task agent (ask-to-artifact routing blueprint §2).
-- Numbering: 0016 re-verified free at build time — 0001–0015 exist (0011 taken
-- twice by parallel sessions), so the blueprint's number stands.
-- The agents table ships in 0013; syncAgentBaselines() would insert this row at
-- boot anyway, but without the cheap-model default — this seed's one job is
-- model = 'claude-haiku-4-5' (blueprint decision §0.1-3). The conflict clause
-- fills the model only when it is currently null, so it never clobbers a
-- NON-NULL admin choice (an admin who explicitly cleared the model back to
-- the platform default gets haiku re-applied on re-run — accepted: that
-- restores this agent's intended default) and re-running is idempotent.
-- (base_prompt is not seeded — boot sync owns it from agentPrompts.ts, same as
-- the other six task agents per 0013's pattern.)

insert into agents (key, kind, name, description, model, defaults) values (
  'ask-router', 'task',
  'Ask router',
  'Classifies Ask-the-War-Room requests as questions or artifact requests; for artifact requests it proposes the template, product, and brief for a one-click-confirm generation. Disabled = classification skipped, every request is answered as a question.',
  'claude-haiku-4-5',
  '{"min_confidence": 0.6}'::jsonb
)
on conflict (key) do update
  set model = coalesce(agents.model, excluded.model);
