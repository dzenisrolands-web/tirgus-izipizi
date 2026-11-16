-- P1.3: metadata only. Does NOT read application rows or execute exposed RPCs.
-- Keep the result private: catalog policy expressions may identify administrators.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
WITH relations AS (
  SELECT c.oid, n.nspname, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity,
    pg_get_userbyid(c.relowner) AS owner,
    has_schema_privilege('anon',n.oid,'USAGE') AS schema_usage,
    has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
    has_any_column_privilege('anon',c.oid,'SELECT') AS anon_any_column_select,
    has_table_privilege('anon',c.oid,'INSERT') AS anon_insert,
    has_table_privilege('anon',c.oid,'UPDATE') AS anon_update,
    has_table_privilege('anon',c.oid,'DELETE') AS anon_delete,
    has_table_privilege('anon',c.oid,'TRUNCATE') AS anon_truncate,
    has_table_privilege('anon',c.oid,'REFERENCES') AS anon_references,
    has_table_privilege('anon',c.oid,'TRIGGER') AS anon_trigger,
    c.reloptions
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE c.relkind IN ('r','p','v','m','f')
    AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'
), table_report AS (
  SELECT r.nspname,r.relname,jsonb_build_object(
    'schema',r.nspname,'table',r.relname,'kind',r.relkind,'owner',r.owner,
    'rls_enabled',r.relrowsecurity,'rls_forced',r.relforcerowsecurity,
    'anon_schema_usage',r.schema_usage,
    'anon_table_grants',jsonb_build_object('select',r.anon_select,'insert',r.anon_insert,
      'update',r.anon_update,'delete',r.anon_delete,'truncate',r.anon_truncate,
      'references',r.anon_references,'trigger',r.anon_trigger),
    'anon_any_column_select',r.anon_any_column_select,
    'column_grants',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'column',a.attname,'select',has_column_privilege('anon',r.oid,a.attnum,'SELECT'),
      'insert',has_column_privilege('anon',r.oid,a.attnum,'INSERT'),
      'update',has_column_privilege('anon',r.oid,a.attnum,'UPDATE')) ORDER BY a.attnum)
      FROM pg_attribute a WHERE a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped),'[]'::jsonb),
    'policies',coalesce((SELECT jsonb_agg(jsonb_build_object(
      'name',p.policyname,'command',p.cmd,'roles',p.roles,'permissive',p.permissive,
      'using',p.qual,'with_check',p.with_check,
      'applies_to_anon',EXISTS(SELECT 1 FROM unnest(p.roles) role_name
        WHERE CASE WHEN role_name='public' THEN true ELSE pg_has_role('anon',role_name::text,'MEMBER') END))
      ORDER BY p.policyname) FROM pg_policies p WHERE p.schemaname=r.nspname AND p.tablename=r.relname),'[]'::jsonb),
    'view_security_invoker',coalesce('security_invoker=true'=ANY(r.reloptions),false),
    'risk_flags',to_jsonb(array_remove(ARRAY[
      CASE WHEN r.schema_usage AND r.anon_truncate THEN 'CRITICAL_TRUNCATE_GRANT_RLS_DOES_NOT_PROTECT' END,
      CASE WHEN r.schema_usage AND r.relkind IN ('r','p') AND NOT r.relrowsecurity
        AND (r.anon_insert OR r.anon_update OR r.anon_delete) THEN 'HIGH_WRITE_GRANT_WITHOUT_RLS' END,
      CASE WHEN r.schema_usage AND r.relkind IN ('r','p') AND NOT r.relrowsecurity
        AND r.anon_any_column_select THEN 'UNFILTERED_READ_REVIEW_COLUMNS' END,
      CASE WHEN r.schema_usage AND r.relkind IN ('v','m') AND r.anon_any_column_select THEN 'VIEW_OWNER_DEPENDENCY_AND_COLUMN_REVIEW' END,
      CASE WHEN r.schema_usage AND (r.anon_insert OR r.anon_update OR r.anon_delete) THEN 'WRITE_POLICIES_REQUIRE_REVIEW' END
    ],NULL)),
    'row_visibility','not_tested_no_application_rows_read'
  ) AS detail FROM relations r
), functions_report AS (
  SELECT n.nspname,p.proname,jsonb_build_object(
    'schema',n.nspname,'function',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),
    'security_definer',p.prosecdef,'owner',pg_get_userbyid(p.proowner),'volatility',p.provolatile,
    'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
    'anon_schema_usage',has_schema_privilege('anon',n.oid,'USAGE'),
    'risk',CASE WHEN p.prosecdef AND has_function_privilege('anon',p.oid,'EXECUTE')
      THEN 'SECURITY_DEFINER_BODY_AND_SEARCH_PATH_REVIEW_REQUIRED' ELSE 'REVIEW_API_EXPOSURE_AND_INTENT' END
  ) AS detail FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' AND p.prokind IN ('f','p')
)
SELECT jsonb_build_object(
  'audit_kind','catalog_metadata_only',
  'configured_exposed_schemas',nullif(current_setting('pgrst.db_schemas',true),''),
  'api_exposure_verified',false,'application_rows_read',false,'writes_executed',false,
  'anon_role',(SELECT jsonb_build_object('superuser',rolsuper,'bypass_rls',rolbypassrls,'inherit',rolinherit)
    FROM pg_roles WHERE rolname='anon'),
  'default_privileges',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'owner',pg_get_userbyid(d.defaclrole),'schema',n.nspname,'object_type',d.defaclobjtype,
    'acl',d.defaclacl::text) ORDER BY d.defaclrole,n.nspname,d.defaclobjtype),'[]'::jsonb)
    FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace),
  'tables',coalesce((SELECT jsonb_agg(detail ORDER BY nspname,relname) FROM table_report),'[]'::jsonb),
  'functions',coalesce((SELECT jsonb_agg(detail ORDER BY nspname,proname) FROM functions_report),'[]'::jsonb),
  'caveat','Privileges are not row visibility. Review applicable PUBLIC/inherited permissive and restrictive policies, column grants, owner-security views and SECURITY DEFINER RPCs.'
) AS anon_rls_audit;
COMMIT;
