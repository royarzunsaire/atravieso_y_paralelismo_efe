-- ============================================================
-- Ampliación de archivos_outbox: ciclo de sync propio
--
-- Hasta ahora archivos_outbox solo se usaba para archivos que viajaban
-- INLINE junto con la inspección (mismo POST /guardar). Esta ampliación
-- permite que un archivo se suba en su propio POST, separado de la
-- inspección, con su propio estado de sync — necesario porque:
--   1) Evita POSTs gigantes (20-40MB) en conexión móvil inestable.
--   2) Permite subir fotos a una inspección YA sincronizada con
--      SharePoint (sharepoint_inspeccion_id), no solo a inspecciones
--      todavía pendientes en Oracle (inspeccion_outbox_id).
--   3) Corrige un bug real: hoy si una foto falla al subir, queda
--      perdida sin ningún reintento — con esto cada archivo tiene su
--      propio ciclo pendiente -> enviado | error, igual que la
--      inspección misma.
-- ============================================================

ALTER TABLE archivos_outbox MODIFY (inspeccion_outbox_id NULL);

ALTER TABLE archivos_outbox ADD (
  estado                    VARCHAR2(20) DEFAULT 'pendiente' NOT NULL,
  intentos                  NUMBER(2)    DEFAULT 0 NOT NULL,
  updated_at                TIMESTAMP,
  sharepoint_inspeccion_id  VARCHAR2(50),
  solicitud_id              NUMBER
);

-- Un archivo debe tener exactamente una de las dos referencias, nunca
-- ambas ni ninguna — o cuelga de una inspección todavía en Oracle
-- (inspeccion_outbox_id) o de una ya sincronizada en SharePoint
-- (sharepoint_inspeccion_id).
ALTER TABLE archivos_outbox ADD CONSTRAINT chk_archivo_una_referencia
  CHECK (
    (inspeccion_outbox_id IS NOT NULL AND sharepoint_inspeccion_id IS NULL)
    OR
    (inspeccion_outbox_id IS NULL AND sharepoint_inspeccion_id IS NOT NULL)
  );

CREATE OR REPLACE TRIGGER trg_archivos_outbox_bi
BEFORE INSERT ON archivos_outbox
FOR EACH ROW
BEGIN
  IF :NEW.id IS NULL THEN
    :NEW.id := SYS_GUID();
  END IF;
  IF :NEW.created_at IS NULL THEN
    :NEW.created_at := CURRENT_TIMESTAMP;
  END IF;
  IF :NEW.updated_at IS NULL THEN
    :NEW.updated_at := CURRENT_TIMESTAMP;
  END IF;
END;
/

-- ============================================================
-- POST /inspecciones-actions/archivo/guardar
-- INSERT de un archivo suelto (fuera del flujo inline de "guardar"
-- inspección). Acepta inspeccion_outbox_id O sharepoint_inspeccion_id,
-- nunca ambos (ver CHECK constraint arriba).
-- ============================================================

BEGIN
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'api_inspecciones_actions',
    p_pattern     => 'archivo/guardar'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'api_inspecciones_actions',
    p_pattern     => 'archivo/guardar',
    p_method      => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_source      => q'[
      DECLARE
        v_id RAW(16) := SYS_GUID();
      BEGIN
        INSERT INTO archivos_outbox (
          id, inspeccion_outbox_id, sharepoint_inspeccion_id, solicitud_id,
          tipo, file_name, content_type, file_base64, estado, intentos
        ) VALUES (
          v_id,
          CASE WHEN :inspeccion_outbox_id IS NOT NULL THEN HEXTORAW(:inspeccion_outbox_id) END,
          :sharepoint_inspeccion_id,
          :solicitud_id,
          :tipo, :file_name, :content_type, :file_base64, 'pendiente', 0
        );
        :id_out := RAWTOHEX(v_id);
      END;
    ]'
  );

  ORDS.DEFINE_PARAMETER(
    p_module_name        => 'api_inspecciones_actions',
    p_pattern            => 'archivo/guardar',
    p_method             => 'POST',
    p_name               => 'id_out',
    p_bind_variable_name => 'id_out',
    p_source_type        => 'RESPONSE',
    p_param_type         => 'STRING',
    p_access_method      => 'OUT'
  );

  COMMIT;
END;
/

-- ============================================================
-- GET /inspecciones-actions/archivos-pendientes
-- Archivos listos para sincronizar: estado='pendiente' (o 'error' con
-- intentos<3) y con un sharepoint_inspeccion_id resuelto — ya sea
-- directo (archivo de inspección vieja) o vía join con
-- inspecciones_outbox (archivo de inspección que recién se sincronizó).
-- Archivos de una inspección que AÚN está pendiente en Oracle no
-- aparecen aquí todavía (esperan a que la inspección tenga sharepoint_id).
-- ============================================================

BEGIN
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'api_inspecciones_actions',
    p_pattern     => 'archivos-pendientes'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name    => 'api_inspecciones_actions',
    p_pattern        => 'archivos-pendientes',
    p_method         => 'GET',
    p_source_type    => ORDS.source_type_collection_feed,
    p_items_per_page => 50,
    p_source         => q'[
      SELECT
        RAWTOHEX(a.id) AS id,
        a.tipo,
        a.file_name,
        a.content_type,
        a.file_base64,
        a.estado,
        a.intentos,
        a.solicitud_id,
        COALESCE(a.sharepoint_inspeccion_id, i.sharepoint_id) AS sharepoint_inspeccion_id
      FROM archivos_outbox a
      LEFT JOIN inspecciones_outbox i ON i.id = a.inspeccion_outbox_id
      WHERE (a.estado = 'pendiente' OR (a.estado = 'error' AND a.intentos < 3))
        AND COALESCE(a.sharepoint_inspeccion_id, i.sharepoint_id) IS NOT NULL
      ORDER BY a.created_at ASC
    ]'
  );

  COMMIT;
END;
/

-- ============================================================
-- POST /inspecciones-actions/archivo/{id}/marcar-resultado
-- Mismo patrón que marcar-resultado de inspección, pero por archivo.
-- ============================================================

BEGIN
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'api_inspecciones_actions',
    p_pattern     => 'archivo/:id/marcar-resultado'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'api_inspecciones_actions',
    p_pattern     => 'archivo/:id/marcar-resultado',
    p_method      => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_source      => q'[
      DECLARE
        v_id       RAW(16) := HEXTORAW(:id);
        v_intentos NUMBER(2);
      BEGIN
        SELECT intentos INTO v_intentos FROM archivos_outbox WHERE id = v_id FOR UPDATE;
        v_intentos := v_intentos + 1;

        UPDATE archivos_outbox
        SET estado = CASE WHEN :resultado = 'exito' THEN 'enviado' ELSE 'error' END,
            intentos = v_intentos,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_id;
      END;
    ]'
  );

  COMMIT;
END;
/

-- ============================================================
-- GET /inspecciones-actions/archivos-por-solicitud/{solicitud_id}
-- Para que el frontend pueda saber si hay archivos con error asociados
-- a una solicitud (para extender el badge existente), igual patrón que
-- por-solicitud pero para archivos.
-- ============================================================

BEGIN
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'api_inspecciones_actions',
    p_pattern     => 'archivos-por-solicitud/:solicitud_id'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name    => 'api_inspecciones_actions',
    p_pattern        => 'archivos-por-solicitud/:solicitud_id',
    p_method         => 'GET',
    p_source_type    => ORDS.source_type_collection_feed,
    p_items_per_page => 50,
    p_source         => q'[
      SELECT
        RAWTOHEX(a.id) AS id,
        a.tipo,
        a.file_name,
        a.estado,
        a.intentos,
        COALESCE(a.sharepoint_inspeccion_id, i.sharepoint_id) AS sharepoint_inspeccion_id
      FROM archivos_outbox a
      LEFT JOIN inspecciones_outbox i ON i.id = a.inspeccion_outbox_id
      WHERE a.solicitud_id = :solicitud_id
        AND a.estado = 'error'
      ORDER BY a.created_at ASC
    ]'
  );

  COMMIT;
END;
/
