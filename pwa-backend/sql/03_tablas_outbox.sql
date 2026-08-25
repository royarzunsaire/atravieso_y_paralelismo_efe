-- ============================================================
-- Tablas del Transactional Outbox de inspecciones
-- (Confirmado con Rodrigo — DDL ejecutado tal cual en SQL Developer Web)
-- ============================================================

CREATE TABLE inspecciones_outbox (
  id              RAW(16)       DEFAULT SYS_GUID() PRIMARY KEY,
  solicitud_id    NUMBER        NOT NULL,
  payload_json    CLOB          NOT NULL,
  estado          VARCHAR2(20)  DEFAULT 'pendiente' NOT NULL,
  intentos        NUMBER(2)     DEFAULT 0 NOT NULL,
  sharepoint_id   VARCHAR2(50),
  created_at      TIMESTAMP,
  updated_at      TIMESTAMP
);

CREATE TABLE archivos_outbox (
  id                    RAW(16)       DEFAULT SYS_GUID() PRIMARY KEY,
  inspeccion_outbox_id  RAW(16)       NOT NULL,
  tipo                  VARCHAR2(10)  NOT NULL,
  file_name             VARCHAR2(255) NOT NULL,
  content_type          VARCHAR2(100),
  file_base64           CLOB          NOT NULL,
  sharepoint_id         VARCHAR2(50),
  created_at            TIMESTAMP,
  CONSTRAINT fk_archivos_inspeccion FOREIGN KEY (inspeccion_outbox_id)
    REFERENCES inspecciones_outbox(id)
);

CREATE TABLE sync_log (
  id                    RAW(16)      DEFAULT SYS_GUID() PRIMARY KEY,
  inspeccion_outbox_id  RAW(16)      NOT NULL,
  intento_numero        NUMBER(2)    NOT NULL,
  resultado             VARCHAR2(10) NOT NULL,
  mensaje               VARCHAR2(4000),
  created_at            TIMESTAMP,
  CONSTRAINT fk_synclog_inspeccion FOREIGN KEY (inspeccion_outbox_id)
    REFERENCES inspecciones_outbox(id)
);

-- Mismo patrón que trg_usuarios_bi — AutoREST/PL·SQL manual no dispara
-- los DEFAULT de columna en INSERT (ver bug #1 en oracle-ords.md).

CREATE OR REPLACE TRIGGER trg_inspecciones_outbox_bi
BEFORE INSERT ON inspecciones_outbox
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
END;
/

CREATE OR REPLACE TRIGGER trg_sync_log_bi
BEFORE INSERT ON sync_log
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
