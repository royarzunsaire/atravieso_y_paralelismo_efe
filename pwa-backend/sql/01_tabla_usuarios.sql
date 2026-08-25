-- ============================================================
-- Tabla usuarios + AutoREST + acciones manuales
-- (Reconstruido desde oracle-ords.md — migración Supabase → Oracle)
-- ============================================================

CREATE TABLE usuarios (
  id         RAW(16) DEFAULT SYS_GUID() PRIMARY KEY,
  email      VARCHAR2(255) NOT NULL UNIQUE,
  password   VARCHAR2(255),
  nombre     VARCHAR2(255) NOT NULL,
  rol        VARCHAR2(50)  DEFAULT 'usuario' NOT NULL,
  auth_type  VARCHAR2(50)  DEFAULT 'local' NOT NULL,
  activo     NUMBER(1)     DEFAULT 1 NOT NULL,
  created_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP NOT NULL,
  last_login TIMESTAMP
);

-- AutoREST no dispara los DEFAULT de columna en INSERT (SYS_GUID(), CURRENT_TIMESTAMP)
-- Ver bug #1 en oracle-ords.md
CREATE OR REPLACE TRIGGER trg_usuarios_bi
BEFORE INSERT ON usuarios
FOR EACH ROW
BEGIN
  IF :NEW.id IS NULL THEN
    :NEW.id := SYS_GUID();
  END IF;
  IF :NEW.created_at IS NULL THEN
    :NEW.created_at := CURRENT_TIMESTAMP;
  END IF;
END;
/

BEGIN
  ORDS.ENABLE_OBJECT(
    p_enabled      => TRUE,
    p_schema       => 'ATRAVIESO_PARALELISMO',
    p_object       => 'USUARIOS',
    p_object_type  => 'TABLE',
    p_object_alias => 'usuarios',
    p_auto_rest_auth => TRUE -- protegido por privilegio interno de AutoREST, ver 02_oauth2_clients_roles.sql
  );
  COMMIT;
END;
/

-- ============================================================
-- Módulo manual api_usuarios_actions
-- (necesario por los bugs de TIMESTAMP vía JSON — ver bugs #2, #3, #6)
-- ============================================================

BEGIN
  ORDS.DEFINE_MODULE(
    p_module_name    => 'api_usuarios_actions',
    p_base_path      => '/usuarios-actions/',
    p_items_per_page => 25
  );
  COMMIT;
END;
/

-- POST /usuarios-actions/register
BEGIN
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'api_usuarios_actions',
    p_pattern     => 'register'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'api_usuarios_actions',
    p_pattern     => 'register',
    p_method      => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_source      => q'[
      DECLARE
        v_id RAW(16) := SYS_GUID();
      BEGIN
        INSERT INTO usuarios (id, email, password, nombre, rol, auth_type, activo, created_at)
        VALUES (v_id, :email, :password, :nombre, NVL(:rol, 'usuario'), 'local', 1, CURRENT_TIMESTAMP);
        :id_out := RAWTOHEX(v_id);
      END;
    ]'
  );

  ORDS.DEFINE_PARAMETER(
    p_module_name    => 'api_usuarios_actions',
    p_pattern        => 'register',
    p_method         => 'POST',
    p_name           => 'id_out',
    p_bind_variable_name => 'id_out',
    p_source_type    => 'RESPONSE',
    p_param_type     => 'STRING',
    p_access_method  => 'OUT'
  );

  COMMIT;
END;
/

-- POST /usuarios-actions/{id}/last-login
BEGIN
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'api_usuarios_actions',
    p_pattern     => ':id/last-login'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'api_usuarios_actions',
    p_pattern     => ':id/last-login',
    p_method      => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_source      => q'[
      BEGIN
        UPDATE usuarios SET last_login = CURRENT_TIMESTAMP WHERE id = HEXTORAW(:id);
      END;
    ]'
  );

  COMMIT;
END;
/

-- POST /usuarios-actions/{id}/change-password
BEGIN
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'api_usuarios_actions',
    p_pattern     => ':id/change-password'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'api_usuarios_actions',
    p_pattern     => ':id/change-password',
    p_method      => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_source      => q'[
      BEGIN
        UPDATE usuarios SET password = :password WHERE id = HEXTORAW(:id);
      END;
    ]'
  );

  COMMIT;
END;
/
