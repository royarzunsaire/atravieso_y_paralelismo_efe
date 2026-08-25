-- ============================================================
-- OAuth2 Client Credentials — roles, privilegios, clients
-- (Reconstruido desde oracle-ords.md, sección "Historial de sesiones de seguridad")
-- ============================================================

-- Roles
BEGIN
  ORDS.CREATE_ROLE(p_role_name => 'AYP_BACKEND_ROLE');
  ORDS.CREATE_ROLE(p_role_name => 'AYP_USUARIOS_CREAR_ROLE');
  COMMIT;
END;
/

-- Privilegio del módulo custom /usuarios-actions/*
-- (con / inicial obligatorio — ver bug de sintaxis de patrones en oracle-ords.md)
DECLARE
  l_roles    owa.vc_arr;
  l_patterns owa.vc_arr;
BEGIN
  l_roles(1) := 'AYP_BACKEND_ROLE';
  l_roles(2) := 'AYP_USUARIOS_CREAR_ROLE';
  l_patterns(1) := '/usuarios-actions/*';

  ORDS.DEFINE_PRIVILEGE(
    p_privilege_name => 'ayp.usuarios.actions',
    p_roles          => l_roles,
    p_patterns       => l_patterns,
    p_label          => 'AyP - usuarios actions',
    p_description    => 'Acceso a POST /usuarios-actions/* (register, last-login, change-password)'
  );
  COMMIT;
END;
/

-- Tabla usuarios (AutoREST) — NO crear privilegio custom, otorgar el rol
-- del privilegio interno que ORDS ya crea automáticamente (ver bug ORA-20039
-- en oracle-ords.md, sección "Proteger AutoREST").
-- Verificar primero el nombre exacto del rol interno:
--   SELECT p.id, p.name, r.role_name
--   FROM user_ords_privileges p
--   JOIN user_ords_privilege_roles r ON r.privilege_id = p.id
--   WHERE p.name = 'oracle.dbtools.autorest.privilege.ATRAVIESO_PARALELISMO.USUARIOS';

-- Módulo custom api_inspecciones_actions/* — mismo patrón, privilegio propio
DECLARE
  l_roles    owa.vc_arr;
  l_patterns owa.vc_arr;
BEGIN
  l_roles(1) := 'AYP_BACKEND_ROLE';
  l_patterns(1) := '/inspecciones-actions/*';

  ORDS.DEFINE_PRIVILEGE(
    p_privilege_name => 'ayp.inspecciones.actions',
    p_roles          => l_roles,
    p_patterns       => l_patterns,
    p_label          => 'AyP - inspecciones actions',
    p_description    => 'Acceso a /inspecciones-actions/* (outbox)'
  );
  COMMIT;
END;
/

-- Client OAuth2 del backend interno
DECLARE
  l_client_cred ords_types.t_client_credentials;
BEGIN
  l_client_cred := ORDS_SECURITY.REGISTER_CLIENT(
      p_name          => 'AYP_BACKEND_NODEJS',
      p_grant_type    => 'client_credentials',
      p_support_email => 'raos.fast@gmail.com',
      p_description   => 'Backend Node.js (Render) - acceso interno completo'
  );

  ORDS_SECURITY.GRANT_CLIENT_ROLE(
      p_client_name => 'AYP_BACKEND_NODEJS',
      p_role_name   => 'AYP_BACKEND_ROLE'
  );
  ORDS_SECURITY.GRANT_CLIENT_ROLE(
      p_client_name => 'AYP_BACKEND_NODEJS',
      p_role_name   => 'AYP_USUARIOS_CREAR_ROLE'
  );
  ORDS_SECURITY.GRANT_CLIENT_ROLE(
      p_client_name => 'AYP_BACKEND_NODEJS',
      p_role_name   => 'oracle.dbtools.role.autorest.ATRAVIESO_PARALELISMO.USUARIOS'
  );

  -- ⚠️ Activar "DBMS Output" en SQL Developer Web ANTES de correr esto,
  -- si no el secret se pierde silenciosamente (ver bug en oracle-ords.md).
  DBMS_OUTPUT.PUT_LINE('CLIENT_ID: ' || l_client_cred.client_key.client_id);
  DBMS_OUTPUT.PUT_LINE('CLIENT_SECRET: ' || l_client_cred.client_secret.secret);

  COMMIT;
END;
/

-- Client OAuth2 para la integración externa (plataforma del jefe) —
-- aislado, solo puede registrar usuarios, no puede tocar /usuarios/ directo.
DECLARE
  l_client_cred ords_types.t_client_credentials;
BEGIN
  l_client_cred := ORDS_SECURITY.REGISTER_CLIENT(
      p_name          => 'AYP_INTEGRACION_EXTERNA',
      p_grant_type    => 'client_credentials',
      p_support_email => 'raos.fast@gmail.com',
      p_description   => 'Integracion externa - solo registro de usuarios'
  );

  ORDS_SECURITY.GRANT_CLIENT_ROLE(
      p_client_name => 'AYP_INTEGRACION_EXTERNA',
      p_role_name   => 'AYP_USUARIOS_CREAR_ROLE'
  );

  DBMS_OUTPUT.PUT_LINE('CLIENT_ID: ' || l_client_cred.client_key.client_id);
  DBMS_OUTPUT.PUT_LINE('CLIENT_SECRET: ' || l_client_cred.client_secret.secret);

  COMMIT;
END;
/
