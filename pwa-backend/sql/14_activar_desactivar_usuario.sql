-- ============================================================
-- Activar / dar de baja usuarios (consumo externo: app de escritorio del jefe)
-- Columna existente: usuarios.activo  (1 = activo, 0 = dado de baja)
--
-- Dos handlers POST en el módulo api_usuarios_actions:
--   POST /usuarios-actions/{id}/activo                  (id en hex, como los demás)
--   POST /usuarios-actions/por-email/{email}/activo     (correo, como la lectura de usuarios)
-- Cuerpo JSON:  { "activo": 0 }   o   { "activo": 1 }
--
-- Respuestas:
--   200  { "activo_out": 0|1, "mensaje_out": "OK" }
--   400  activo distinto de 0/1, o id con formato inválido
--   404  el usuario no existe
--
-- Solo toca la columna ACTIVO (nunca password, rol ni fechas). «Dar de baja» = activo 0
-- (el usuario no se borra: se conserva su historial y su correo queda reservado).
--
-- No se tocan roles ni privilegios: /usuarios-actions/* ya está cubierto por el
-- privilegio ayp.usuarios.actions, que acepta AYP_BACKEND_ROLE y AYP_USUARIOS_CREAR_ROLE
-- (client externo AYP_INTEGRACION_EXTERNA).
--
-- Efecto en la PWA: el login local solo admite usuarios con activo = 1
-- (database.js → getLocalActiveUserByEmail). Un usuario dado de baja no puede iniciar sesión.
-- OJO: una sesión ya abierta sigue válida hasta que expire su JWT (7 días) salvo que el
-- backend consulte `activo` en cada petición (pendiente de decidir).
-- ============================================================

-- 1) POST /usuarios-actions/{id}/activo
BEGIN
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'api_usuarios_actions',
    p_pattern     => ':id/activo'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'api_usuarios_actions',
    p_pattern     => ':id/activo',
    p_method      => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_source      => q'[
      DECLARE
        v_activo NUMBER;
      BEGIN
        BEGIN
          v_activo := TO_NUMBER(:activo);
        EXCEPTION WHEN OTHERS THEN
          v_activo := NULL;
        END;

        IF v_activo IS NULL OR v_activo NOT IN (0, 1) THEN
          :status_code  := 400;
          :mensaje_out  := 'activo debe ser 0 o 1';
          RETURN;
        END IF;

        UPDATE usuarios SET activo = v_activo WHERE id = HEXTORAW(:id);

        IF SQL%ROWCOUNT = 0 THEN
          :status_code  := 404;
          :mensaje_out  := 'Usuario no encontrado';
        ELSE
          :activo_out   := v_activo;
          :mensaje_out  := 'OK';
        END IF;
      EXCEPTION WHEN OTHERS THEN
        :status_code  := 400;
        :mensaje_out  := 'Solicitud inválida (revisa el id y el valor de activo)';
      END;
    ]'
  );

  ORDS.DEFINE_PARAMETER(
    p_module_name        => 'api_usuarios_actions',
    p_pattern            => ':id/activo',
    p_method             => 'POST',
    p_name               => 'activo_out',
    p_bind_variable_name => 'activo_out',
    p_source_type        => 'RESPONSE',
    p_param_type         => 'INT',
    p_access_method      => 'OUT'
  );

  ORDS.DEFINE_PARAMETER(
    p_module_name        => 'api_usuarios_actions',
    p_pattern            => ':id/activo',
    p_method             => 'POST',
    p_name               => 'mensaje_out',
    p_bind_variable_name => 'mensaje_out',
    p_source_type        => 'RESPONSE',
    p_param_type         => 'STRING',
    p_access_method      => 'OUT'
  );

  COMMIT;
END;
/

-- 2) POST /usuarios-actions/por-email/{email}/activo
BEGIN
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'api_usuarios_actions',
    p_pattern     => 'por-email/:email/activo'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'api_usuarios_actions',
    p_pattern     => 'por-email/:email/activo',
    p_method      => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_source      => q'[
      DECLARE
        v_activo NUMBER;
      BEGIN
        BEGIN
          v_activo := TO_NUMBER(:activo);
        EXCEPTION WHEN OTHERS THEN
          v_activo := NULL;
        END;

        IF v_activo IS NULL OR v_activo NOT IN (0, 1) THEN
          :status_code  := 400;
          :mensaje_out  := 'activo debe ser 0 o 1';
          RETURN;
        END IF;

        UPDATE usuarios SET activo = v_activo WHERE LOWER(email) = LOWER(:email);

        IF SQL%ROWCOUNT = 0 THEN
          :status_code  := 404;
          :mensaje_out  := 'Usuario no encontrado';
        ELSE
          :activo_out   := v_activo;
          :mensaje_out  := 'OK';
        END IF;
      EXCEPTION WHEN OTHERS THEN
        :status_code  := 400;
        :mensaje_out  := 'Solicitud inválida (revisa el correo y el valor de activo)';
      END;
    ]'
  );

  ORDS.DEFINE_PARAMETER(
    p_module_name        => 'api_usuarios_actions',
    p_pattern            => 'por-email/:email/activo',
    p_method             => 'POST',
    p_name               => 'activo_out',
    p_bind_variable_name => 'activo_out',
    p_source_type        => 'RESPONSE',
    p_param_type         => 'INT',
    p_access_method      => 'OUT'
  );

  ORDS.DEFINE_PARAMETER(
    p_module_name        => 'api_usuarios_actions',
    p_pattern            => 'por-email/:email/activo',
    p_method             => 'POST',
    p_name               => 'mensaje_out',
    p_bind_variable_name => 'mensaje_out',
    p_source_type        => 'RESPONSE',
    p_param_type         => 'STRING',
    p_access_method      => 'OUT'
  );

  COMMIT;
END;
/

-- ============================================================
-- Verificación (en SQL Developer Web, después de ejecutar este script):
--   SELECT pattern, method FROM user_ords_handlers h
--     JOIN user_ords_templates t ON t.id = h.template_id
--    WHERE t.pattern LIKE '%activo%';
-- Debe listar 2 filas POST (':id/activo' y 'por-email/:email/activo').
--
-- Para deshacer:
--   BEGIN
--     ORDS.DELETE_HANDLER('api_usuarios_actions', ':id/activo', 'POST');
--     ORDS.DELETE_HANDLER('api_usuarios_actions', 'por-email/:email/activo', 'POST');
--     COMMIT;
--   END;
--   /
-- ============================================================
