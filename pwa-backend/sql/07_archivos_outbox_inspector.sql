-- ============================================================
-- Agrega inspector_email/inspector_nombre a archivos_outbox
--
-- El sync job necesita esta metadata al llamar al flow de subida
-- (FLOW_SUBIR_ARCHIVOS_URL / FLOW_DOCUMENTOS_SUBIR_URL). Para archivos
-- que cuelgan de una inspección todavía en Oracle, este dato se podría
-- sacar del payload_json de la inspección — pero para archivos de una
-- inspección YA en SharePoint (sharepoint_inspeccion_id) no hay de
-- dónde sacarlo. Se guarda directo en el archivo, tomado del usuario
-- autenticado (req.user) en el momento de la subida — más preciso
-- además, porque es quien realmente subió el archivo, no
-- necesariamente quien creó la inspección original.
-- ============================================================

ALTER TABLE archivos_outbox ADD (
  inspector_email   VARCHAR2(255),
  inspector_nombre  VARCHAR2(255)
);

-- Recrear la acción de guardar archivo para aceptar los 2 campos nuevos.
BEGIN
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
          tipo, file_name, content_type, file_base64,
          inspector_email, inspector_nombre, estado, intentos
        ) VALUES (
          v_id,
          CASE WHEN :inspeccion_outbox_id IS NOT NULL THEN HEXTORAW(:inspeccion_outbox_id) END,
          :sharepoint_inspeccion_id,
          :solicitud_id,
          :tipo, :file_name, :content_type, :file_base64,
          :inspector_email, :inspector_nombre, 'pendiente', 0
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

-- Recrear archivos-pendientes para incluir los campos nuevos en la respuesta.
BEGIN
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
        a.inspector_email,
        a.inspector_nombre,
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
