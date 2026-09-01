-- ============================================================
-- Migración del outbox a la API de eventos unificada (Etapa A)
-- (ver .claude/skills/pwa-inspecciones-obra/references/specs/10-migracion-api-eventos.md)
--
-- Agrega a inspecciones_outbox:
--   payload_version    'v1' (flows viejos, default) | 'v2' (API eventos nueva)
--   evento_id_externo  UUID de idempotencia (una sola vez por evento,
--                      reusado en reintentos — la API deduplica por él)
--
-- El sync job (dispatcher versionado) despacha según payload_version:
-- las filas v1 siguen yendo a los flows viejos, las v2 a la API nueva.
-- Las filas viejas NO se reescriben — quedan v1 y drenan solas.
-- ============================================================

ALTER TABLE inspecciones_outbox ADD (
  payload_version    VARCHAR2(4)   DEFAULT 'v1' NOT NULL,
  evento_id_externo  VARCHAR2(36)
);

-- Idempotencia: un EventoIdExterno único. Permite NULL (las filas v1
-- viejas no lo tienen); Oracle no indexa las filas con NULL en un índice
-- único de una sola columna, así que múltiples NULL conviven sin chocar.
CREATE UNIQUE INDEX idx_outbox_evento_ext
  ON inspecciones_outbox (evento_id_externo);

-- ============================================================
-- Recrear POST /guardar para aceptar payload_version y evento_id_externo
-- ============================================================

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'api_inspecciones_actions',
    p_pattern     => 'guardar',
    p_method      => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_source      => q'[
      DECLARE
        v_id          RAW(16) := SYS_GUID();
        v_archivos    JSON_ARRAY_T;
        v_archivo     JSON_OBJECT_T;
        v_tipo        VARCHAR2(10);
        v_file_name   VARCHAR2(255);
        v_content_type VARCHAR2(100);
        v_file_base64 CLOB;
      BEGIN
        INSERT INTO inspecciones_outbox
          (id, solicitud_id, payload_json, estado, intentos, payload_version, evento_id_externo)
        VALUES
          (v_id, :solicitud_id, :payload_json, 'pendiente', 0,
           NVL(:payload_version, 'v1'), :evento_id_externo);

        IF :archivos_json IS NOT NULL THEN
          v_archivos := JSON_ARRAY_T.parse(:archivos_json);
          FOR i IN 0 .. v_archivos.get_size - 1 LOOP
            v_archivo := TREAT(v_archivos.get(i) AS JSON_OBJECT_T);
            v_tipo         := v_archivo.get_string('tipo');
            v_file_name    := v_archivo.get_string('fileName');
            v_content_type := v_archivo.get_string('contentType');
            v_file_base64  := v_archivo.get_clob('fileBase64');

            INSERT INTO archivos_outbox
              (id, inspeccion_outbox_id, tipo, file_name, content_type, file_base64)
            VALUES
              (SYS_GUID(), v_id, v_tipo, v_file_name, v_content_type, v_file_base64);
          END LOOP;
        END IF;

        :id_out := RAWTOHEX(v_id);
      END;
    ]'
  );

  ORDS.DEFINE_PARAMETER(
    p_module_name        => 'api_inspecciones_actions',
    p_pattern            => 'guardar',
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
-- Recrear las 3 acciones GET para exponer payload_version y
-- evento_id_externo (el dispatcher del sync job los necesita para saber
-- qué versión es cada fila y con qué EventoIdExterno reintentar).
-- ============================================================

-- GET /inspecciones-actions/{id}
BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name    => 'api_inspecciones_actions',
    p_pattern        => ':id',
    p_method         => 'GET',
    p_source_type    => ORDS.source_type_collection_feed,
    p_items_per_page => 1,
    p_source         => q'[
      SELECT
        RAWTOHEX(i.id) AS id,
        i.solicitud_id,
        i.payload_json,
        i.estado,
        i.intentos,
        i.sharepoint_id,
        i.payload_version,
        i.evento_id_externo,
        (
          SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
              'id' VALUE RAWTOHEX(a.id),
              'tipo' VALUE a.tipo,
              'fileName' VALUE a.file_name,
              'contentType' VALUE a.content_type,
              'fileBase64' VALUE a.file_base64
            )
          )
          FROM archivos_outbox a
          WHERE a.inspeccion_outbox_id = i.id
        ) AS archivos
      FROM inspecciones_outbox i
      WHERE RAWTOHEX(i.id) = UPPER(:id)
    ]'
  );

  COMMIT;
END;
/

-- GET /inspecciones-actions/pendientes
BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name    => 'api_inspecciones_actions',
    p_pattern        => 'pendientes',
    p_method         => 'GET',
    p_source_type    => ORDS.source_type_collection_feed,
    p_items_per_page => 50,
    p_source         => q'[
      SELECT
        RAWTOHEX(i.id) AS id,
        i.solicitud_id,
        i.payload_json,
        i.estado,
        i.intentos,
        i.sharepoint_id,
        i.payload_version,
        i.evento_id_externo,
        (
          SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
              'id' VALUE RAWTOHEX(a.id),
              'tipo' VALUE a.tipo,
              'fileName' VALUE a.file_name,
              'contentType' VALUE a.content_type,
              'fileBase64' VALUE a.file_base64
            )
          )
          FROM archivos_outbox a
          WHERE a.inspeccion_outbox_id = i.id
        ) AS archivos
      FROM inspecciones_outbox i
      WHERE i.estado = 'pendiente'
         OR (i.estado = 'error' AND i.intentos < 3)
      ORDER BY i.created_at ASC
    ]'
  );

  COMMIT;
END;
/

-- GET /inspecciones-actions/por-solicitud/{solicitud_id}
BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name    => 'api_inspecciones_actions',
    p_pattern        => 'por-solicitud/:solicitud_id',
    p_method         => 'GET',
    p_source_type    => ORDS.source_type_collection_feed,
    p_items_per_page => 50,
    p_source         => q'[
      SELECT
        RAWTOHEX(i.id) AS id,
        i.solicitud_id,
        i.payload_json,
        i.estado,
        i.intentos,
        i.sharepoint_id,
        i.payload_version,
        i.evento_id_externo,
        (
          SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
              'id' VALUE RAWTOHEX(a.id),
              'tipo' VALUE a.tipo,
              'fileName' VALUE a.file_name,
              'contentType' VALUE a.content_type,
              'fileBase64' VALUE a.file_base64
            )
          )
          FROM archivos_outbox a
          WHERE a.inspeccion_outbox_id = i.id
        ) AS archivos
      FROM inspecciones_outbox i
      WHERE i.solicitud_id = :solicitud_id
        AND i.estado IN ('pendiente', 'error')
      ORDER BY i.created_at ASC
    ]'
  );

  COMMIT;
END;
/
