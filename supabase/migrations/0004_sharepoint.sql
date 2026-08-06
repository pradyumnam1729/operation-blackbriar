-- Microsoft Graph SharePoint connector flag. The local-folder watcher
-- (sharepoint_watcher) remains the stand-in until credentials exist.
insert into feature_flags (key, enabled, note) values
  ('sharepoint_graph', false, 'Live SharePoint sync via Microsoft Graph. Needs MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET in backend env + Sites.Read.All application permission with admin consent.')
on conflict (key) do nothing;
