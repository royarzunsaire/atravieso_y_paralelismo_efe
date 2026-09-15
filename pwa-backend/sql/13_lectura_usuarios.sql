-- ============================================================
-- API de lectura de usuarios (spec 12) — handlers GET en api_usuarios_actions
-- Consumo externo (client OAuth2 AYP_INTEGRACION_EXTERNA).
-- No toca roles/privilegios: /usuarios-actions/* ya está cubierto por
-- el privilegio ayp.usuarios.actions, que acepta AYP_USUARIOS_CREAR_ROLE.
-- ============================================================

-- 0) NOTA DE ZONA HORARIA (verificado 2026-09-11):
--    ORDS inserta en UTC (DBTIMEZONE=+00:00; prueba de login confirmó que
--    last_login guardado ≈ SYSTIMESTAMP en +00:00). Por lo tanto created_at
--    y last_login YA están en UTC — NO se convierte, solo se formatea con 'Z'.
--    (Un FROM_TZ(col, SESSIONTIMEZONE) sería incorrecto: en SQL Dev Web
--    SESSIONTIMEZONE=America/Santiago y sumaría 4h de más a un valor ya-UTC.)

-- 1) GET /usuarios-actions/listar  (sin hash)
BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'api_usuarios_actions', p_pattern => 'listar');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'api_usuarios_actions',
    p_pattern     => 'listar',
    p_method      => 'GET',
    p_source_type => ORDS.source_type_collection_feed,
    p_source      => q'[
      SELECT RAWTOHEX(id) AS id, email, nombre, rol, auth_type, activo,
        TO_CHAR(created_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
        TO_CHAR(last_login,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_login
      FROM usuarios
      ORDER BY created_at DESC
    ]'
  );
  COMMIT;
END;
/

-- 2) GET /usuarios-actions/por-email/{email}  (CON hash — doble verificación)
BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'api_usuarios_actions', p_pattern => 'por-email/:email');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'api_usuarios_actions',
    p_pattern     => 'por-email/:email',
    p_method      => 'GET',
    p_source_type => ORDS.source_type_collection_feed,
    p_source      => q'[
      SELECT RAWTOHEX(id) AS id, email, nombre, rol, auth_type, activo,
        password AS password_hash,
        TO_CHAR(created_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
        TO_CHAR(last_login,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_login
      FROM usuarios
      WHERE LOWER(email) = LOWER(:email)
    ]'
  );
  COMMIT;
END;
/

-- 3) GET /usuarios-actions/{id}  (sin hash)
-- El template literal 'listar' tiene prioridad sobre el bind ':id' para esa
-- URI exacta, así que no colisionan. 'por-email/:email' es de dos segmentos.
BEGIN
  ORDS.DEFINE_TEMPLATE(p_module_name => 'api_usuarios_actions', p_pattern => ':id');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'api_usuarios_actions',
    p_pattern     => ':id',
    p_method      => 'GET',
    p_source_type => ORDS.source_type_collection_feed,
    p_source      => q'[
      SELECT RAWTOHEX(id) AS id, email, nombre, rol, auth_type, activo,
        TO_CHAR(created_at,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
        TO_CHAR(last_login,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_login
      FROM usuarios
      WHERE id = HEXTORAW(:id)
    ]'
  );
  COMMIT;
END;
/
