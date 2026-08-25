-- ============================================================
-- Módulo api_inspecciones_actions — outbox de inspecciones
-- ============================================================

BEGIN
  ORDS.DEFINE_MODULE(
    p_module_name    => 'api_inspecciones_actions',
    p_base_path      => '/inspecciones-actions/',
    p_items_per_page => 25
  );
  COMMIT;
END;
/

-- ============================================================
-- POST /inspecciones-actions/guardar
-- INSERT atómico: inspección + sus archivos, una sola transacción.
-- Usa JSON_ARRAY_T.parse() con variables extraídas antes del INSERT
-- (ver bug #9 ORA-40573 en oracle-ords.md — los métodos de JSON_OBJECT_T
-- no se pueden llamar inline dentro de un INSERT).
-- ============================================================

BEGIN
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'api_inspecciones_actions',
    p_pattern     => 'guardar'
  );

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
        INSERT INTO inspecciones_outbox (id, solicitud_id, payload_json, estado, intentos)
        VALUES (v_id, :solicitud_id, :payload_json, 'pendiente', 0);

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
-- GET /inspecciones-actions/pendientes
-- Trae inspecciones que el sync job debe procesar: pendiente, o error
-- con menos de 3 intentos. Archivos anidados en un solo SELECT
-- (JSON_ARRAYAGG/JSON_OBJECT, evita N+1 queries).
-- ⚠️ El campo "archivos" llega como string JSON, no array nativo —
-- Node.js debe hacer JSON.parse().
-- ============================================================

BEGIN
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'api_inspecciones_actions',
    p_pattern     => 'pendientes'
  );

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

-- ============================================================
-- POST /inspecciones-actions/{id}/marcar-resultado
-- Actualiza estado/intentos/sharepoint_id e inserta en sync_log,
-- todo en una transacción. Tope de 3 intentos: al llegar a 3 con
-- resultado='error', el estado queda en 'error' terminal.
-- ============================================================

BEGIN
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'api_inspecciones_actions',
    p_pattern     => ':id/marcar-resultado'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'api_inspecciones_actions',
    p_pattern     => ':id/marcar-resultado',
    p_method      => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_source      => q'[
      DECLARE
        v_id         RAW(16) := HEXTORAW(:id);
        v_intentos   NUMBER(2);
        v_nuevo_estado VARCHAR2(20);
      BEGIN
        SELECT intentos INTO v_intentos FROM inspecciones_outbox WHERE id = v_id FOR UPDATE;
        v_intentos := v_intentos + 1;

        IF :resultado = 'exito' THEN
          v_nuevo_estado := 'enviado';
        ELSIF v_intentos >= 3 THEN
          v_nuevo_estado := 'error';
        ELSE
          v_nuevo_estado := 'error'; -- error transitorio, sigue siendo candidato en /pendientes mientras intentos < 3
        END IF;

        UPDATE inspecciones_outbox
        SET estado = v_nuevo_estado,
            intentos = v_intentos,
            sharepoint_id = COALESCE(:sharepoint_id, sharepoint_id),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = v_id;

        INSERT INTO sync_log (id, inspeccion_outbox_id, intento_numero, resultado, mensaje)
        VALUES (SYS_GUID(), v_id, v_intentos, :resultado, :mensaje);
      END;
    ]'
  );

  COMMIT;
END;
/

-- ============================================================
-- GET /inspecciones-actions/{id}
-- Fila única con sus archivos — mismo patrón JSON_ARRAYAGG que
-- "pendientes", filtrado por id. source_type_collection_feed con
-- p_items_per_page => 1 envuelve la respuesta en items[0].
-- ============================================================

BEGIN
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'api_inspecciones_actions',
    p_pattern     => ':id'
  );

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
