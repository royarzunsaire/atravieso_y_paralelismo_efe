-- ============================================================
-- Expone sharepoint_id en las acciones GET de inspecciones_outbox
--
-- Bug encontrado en producción: POST /:id/reintentar, cuando recibe un
-- oracleId, siempre llamaba a procesarInspeccion() (que recrea la
-- inspección en SharePoint vía el flow), sin verificar si esa inspección
-- YA estaba sincronizada (estado='enviado', con sharepoint_id real) y
-- solo necesitaba reintentar un archivo. Resultado: inspección duplicada
-- en SharePoint. La corrección en database.js/routes/inspecciones.js
-- necesita leer sharepoint_id, que hasta ahora ninguna acción GET
-- devolvía (solo se usaba internamente en marcar-resultado).
-- ============================================================

BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'api_inspecciones_actions',
    p_pattern     => ':id',
    p_method      => 'GET',
    p_source_type => ORDS.source_type_collection_feed,
    p_items_per_page => 1,
    p_source      => q'[
      SELECT
        RAWTOHEX(i.id) AS id,
        i.solicitud_id,
        i.payload_json,
        i.estado,
        i.intentos,
        i.sharepoint_id,
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
