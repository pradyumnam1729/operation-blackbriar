-- Allow the sharepoint_credentials row (Graph credentials saved from the
-- admin UI) in the integrations table.
alter table integrations drop constraint if exists integrations_kind_check;
alter table integrations add constraint integrations_kind_check
  check (kind in ('sharepoint_local', 'sharepoint_graph', 'sharepoint_credentials', 'salesforce', 'canva', 'smtp'));
