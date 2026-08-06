-- Local Input/Output folder pair (SharePoint stand-in that is fully first-class):
-- Input is watched and ingested; Output receives exported final artifacts.
alter table integrations drop constraint if exists integrations_kind_check;
alter table integrations add constraint integrations_kind_check
  check (kind in ('sharepoint_local', 'sharepoint_graph', 'sharepoint_credentials', 'local_folders', 'salesforce', 'canva', 'smtp'));
