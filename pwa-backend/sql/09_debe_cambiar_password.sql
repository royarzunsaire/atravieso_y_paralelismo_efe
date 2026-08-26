-- ============================================================
-- Forzar cambio de contraseña en el primer login
-- (ver .claude/skills/pwa-inspecciones-obra/references/specs/08-forzar-cambio-password.md)
-- ============================================================

ALTER TABLE usuarios ADD (
  debe_cambiar_password NUMBER(1) DEFAULT 1 NOT NULL
);

-- Retroactivo: todos los usuarios existentes (incluyendo el admin ya
-- migrado desde Supabase) deben cambiar su contraseña en el próximo login.
UPDATE usuarios SET debe_cambiar_password = 1;
COMMIT;

-- ============================================================
-- POST /usuarios-actions/{id}/change-password
-- Recreado para limpiar debe_cambiar_password en la misma transacción
-- que actualiza la contraseña (antes solo actualizaba password).
-- ============================================================

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'api_usuarios_actions',
    p_pattern     => ':id/change-password',
    p_method      => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_source      => q'[
      BEGIN
        UPDATE usuarios
        SET password = :password,
            debe_cambiar_password = 0
        WHERE id = HEXTORAW(:id);
      END;
    ]'
  );

  COMMIT;
END;
/

-- ============================================================
-- POST /usuarios-actions/{id}/reset-password
-- Nueva acción: reset de contraseña por admin — actualiza password Y
-- vuelve a activar debe_cambiar_password (a diferencia de
-- change-password, que lo desactiva). Antes esto lo hacía el mismo
-- endpoint que change-password (updateUserPassword genérico); se separa
-- porque el comportamiento del flag es opuesto en cada caso.
-- ============================================================

BEGIN
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'api_usuarios_actions',
    p_pattern     => ':id/reset-password'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'api_usuarios_actions',
    p_pattern     => ':id/reset-password',
    p_method      => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_source      => q'[
      BEGIN
        UPDATE usuarios
        SET password = :password,
            debe_cambiar_password = 1
        WHERE id = HEXTORAW(:id);
      END;
    ]'
  );

  COMMIT;
END;
/
