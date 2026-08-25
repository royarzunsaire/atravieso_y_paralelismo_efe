-- ============================================================
-- GET /inspecciones-actions/por-solicitud/{solicitud_id}
--
-- Corrige un bug descubierto al verificar la Fase E (frontend):
-- /inspecciones-actions/pendientes filtra
--   estado='pendiente' OR (estado='error' AND intentos<3)
-- porque ESE endpoint es para que el sync job sepa qué reintentar.
-- Pero routes/inspecciones.js reutilizaba ese mismo endpoint para
-- construir el listado que ve el usuario (GET /api/inspecciones/solicitud/:id),
-- así que una inspección con intentos=3 (error terminal, ya no la
-- reintenta el job automático) desaparecía del listado por completo —
-- el usuario nunca veía el badge de error ni el botón de reintentar.
--
-- Esta acción nueva no filtra por intentos: devuelve TODO lo que sigue
-- sin sincronizar (pendiente o error, sin importar cuántos intentos)
-- para una solicitud específica, que es exactamente lo que el usuario
-- necesita ver en su listado.
-- ============================================================

BEGIN
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'api_inspecciones_actions',
    p_pattern     => 'por-solicitud/:solicitud_id'
  );

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
