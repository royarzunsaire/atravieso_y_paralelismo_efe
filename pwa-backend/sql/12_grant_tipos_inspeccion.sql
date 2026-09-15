-- ============================================================
-- Otorgar al client OAuth2 del backend (AYP_BACKEND_NODEJS) el rol
-- interno que ORDS creó automáticamente al habilitar AutoREST protegido
-- (p_auto_rest_auth => TRUE) sobre tipos_inspeccion — mismo patrón que
-- ya se hizo para USUARIOS en 02_oauth2_clients_roles.sql línea 82-85.
--
-- Sin este GRANT, cualquier GET a /tipos_inspeccion/ responde 401 aunque
-- el token OAuth2 del backend sea válido — el token autentica al client,
-- pero el rol autoriza el acceso a ESTE objeto específico.
-- ============================================================

-- 1. Verificar primero el nombre exacto del rol interno (por si el
--    patrón oracle.dbtools.role.autorest.<SCHEMA>.<TABLA> no calza 1:1):
--
--    SELECT p.id, p.name, r.role_name
--    FROM user_ords_privileges p
--    JOIN user_ords_privilege_roles r ON r.privilege_id = p.id
--    WHERE p.name LIKE '%TIPOS_INSPECCION%';

-- 2. Otorgar el rol al client ya registrado (AYP_BACKEND_NODEJS).
BEGIN
  ORDS_SECURITY.GRANT_CLIENT_ROLE(
      p_client_name => 'AYP_BACKEND_NODEJS',
      p_role_name   => 'oracle.dbtools.role.autorest.ATRAVIESO_PARALELISMO.TIPOS_INSPECCION'
  );
  COMMIT;
END;
/
