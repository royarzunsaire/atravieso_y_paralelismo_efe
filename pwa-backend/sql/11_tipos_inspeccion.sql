-- ============================================================
-- Tabla tipos_inspeccion + AutoREST + carga inicial
--
-- Reemplaza el flow de Power Automate (FLOW_TIPOS_INSPECCION_URL) que
-- hoy trae los tipos de inspección desde la lista "Tipo_Inspeccion" de
-- SharePoint. El jefe de Rodrigo sincronizará esta tabla directamente
-- desde su lado (solo lectura para nuestro backend, no se expone
-- ningún endpoint de escritura).
--
-- La lista de SharePoint solo tiene una columna real ("Título"). Se
-- agrega id_sharepoint para que el sync por su lado pueda hacer upsert
-- por el ID nativo de SharePoint (estable aunque cambie el texto del
-- título) — id_sharepoint NUNCA debe regenerarse, es la clave de
-- sincronización con SharePoint. id (Oracle) es la PK interna, no
-- tiene por qué coincidir con id_sharepoint.
-- ============================================================

CREATE TABLE tipos_inspeccion (
  id             NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_sharepoint  NUMBER NOT NULL UNIQUE,
  titulo         VARCHAR2(255) NOT NULL,
  activo         NUMBER(1) DEFAULT 1 NOT NULL,
  orden          NUMBER,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- updated_at se refresca solo en cada UPDATE (útil para que el sync del
-- jefe sepa qué filas tocó por última vez, aunque su proceso no lo setee).
CREATE OR REPLACE TRIGGER trg_tipos_inspeccion_bu
BEFORE UPDATE ON tipos_inspeccion
FOR EACH ROW
BEGIN
  :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

BEGIN
  ORDS.ENABLE_OBJECT(
    p_enabled        => TRUE,
    p_schema         => 'ATRAVIESO_PARALELISMO',
    p_object         => 'TIPOS_INSPECCION',
    p_object_type    => 'TABLE',
    p_object_alias   => 'tipos_inspeccion',
    p_auto_rest_auth => TRUE -- mismo esquema de protección que usuarios (ver 02_oauth2_clients_roles.sql)
  );
  COMMIT;
END;
/

-- ============================================================
-- Carga inicial — igual a la lista SharePoint actual (Título + ID),
-- para no arrancar con la tabla vacía mientras se arma el sync real.
-- orden = el mismo orden en que hoy los devuelve el flow.
-- ============================================================

INSERT INTO tipos_inspeccion (id_sharepoint, titulo, orden) VALUES (1, 'Inspección General', 1);
INSERT INTO tipos_inspeccion (id_sharepoint, titulo, orden) VALUES (2, 'Control de Calidad', 2);
INSERT INTO tipos_inspeccion (id_sharepoint, titulo, orden) VALUES (3, 'Seguridad', 3);
INSERT INTO tipos_inspeccion (id_sharepoint, titulo, orden) VALUES (4, 'Avance de Obra', 4);
INSERT INTO tipos_inspeccion (id_sharepoint, titulo, orden) VALUES (5, 'Recepción de Materiales', 5);
INSERT INTO tipos_inspeccion (id_sharepoint, titulo, orden) VALUES (6, 'Verificación Técnica', 6);
INSERT INTO tipos_inspeccion (id_sharepoint, titulo, orden) VALUES (7, 'Informe Diario', 7);

COMMIT;
