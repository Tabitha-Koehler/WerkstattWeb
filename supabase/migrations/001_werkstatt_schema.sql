-- ============================================================
-- WerkstattWeb – Supabase Migration
-- Alle Tabellen mit Präfix "werkstatt_" um Konflikte mit
-- cargo-dispo-Tabellen (vehicles, drivers) zu vermeiden.
-- ============================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE werkstatt_position_category AS ENUM (
    'REPAIR','INSPECTION','BETRIEBSMITTEL','LABOR','PARTS','TOOLS','OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE werkstatt_inspection_type AS ENUM ('SP','HU','AU');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE werkstatt_tire_axle AS ENUM (
    'FRONT','REAR','FRONT_LEFT','FRONT_RIGHT','REAR_LEFT','REAR_RIGHT','ALL'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE werkstatt_tire_season AS ENUM ('SUMMER','WINTER','ALL_SEASON');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE werkstatt_mileage_source AS ENUM ('MANUAL','INVOICE','INSPECTION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Fahrzeuge ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS werkstatt_vehicles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "licensePlate"  TEXT UNIQUE NOT NULL,
  "vehicleNumber" TEXT,
  vin             TEXT,
  name            TEXT,
  "vehicleType"   TEXT,
  manufacturer    TEXT,
  model           TEXT,
  year            INTEGER,
  notes           TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Rechnungen ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS werkstatt_invoices (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "vehicleId"              UUID REFERENCES werkstatt_vehicles(id) ON DELETE SET NULL,
  "workshopName"           TEXT,
  "invoiceNumber"          TEXT,
  "invoiceDate"            DATE,
  "totalAmount"            NUMERIC(10,2),
  "pdfPath"                TEXT,
  "originalFilename"       TEXT,
  "rawText"                TEXT,
  "repairContext"          TEXT,
  "aiSummary"              TEXT,
  "hasAnomalies"           BOOLEAN NOT NULL DEFAULT FALSE,
  "isWarehouse"            BOOLEAN NOT NULL DEFAULT FALSE,
  "processingError"        BOOLEAN NOT NULL DEFAULT FALSE,
  "processingErrorMessage" TEXT,
  "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Rechnungspositionen ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS werkstatt_invoice_positions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "invoiceId"   UUID NOT NULL REFERENCES werkstatt_invoices(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  quantity      NUMERIC(10,3),
  unit          TEXT,
  "unitPrice"   NUMERIC(10,2),
  "totalPrice"  NUMERIC(10,2),
  category      werkstatt_position_category NOT NULL DEFAULT 'OTHER',
  "isAnomaly"   BOOLEAN NOT NULL DEFAULT FALSE,
  "anomalyReason" TEXT
);

-- ── Prüfungen (SP / HU / AU) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS werkstatt_inspections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "vehicleId"      UUID REFERENCES werkstatt_vehicles(id) ON DELETE CASCADE,
  "invoiceId"      UUID REFERENCES werkstatt_invoices(id) ON DELETE CASCADE,
  type             werkstatt_inspection_type NOT NULL,
  "inspectionDate" DATE,
  "nextDueDate"    DATE,
  mileage          INTEGER,
  notes            TEXT,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Betriebsmittel ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS werkstatt_operating_supplies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "vehicleId" UUID REFERENCES werkstatt_vehicles(id) ON DELETE CASCADE,
  "invoiceId" UUID REFERENCES werkstatt_invoices(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  quantity    NUMERIC(10,3),
  unit        TEXT,
  date        DATE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Reifenhistorie ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS werkstatt_tire_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "vehicleId"  UUID NOT NULL REFERENCES werkstatt_vehicles(id) ON DELETE CASCADE,
  "invoiceId"  UUID REFERENCES werkstatt_invoices(id) ON DELETE SET NULL,
  "changeDate" DATE,
  axle         werkstatt_tire_axle,
  season       werkstatt_tire_season,
  "tireSize"   TEXT,
  manufacturer TEXT,
  dot          TEXT,
  "profileDepth" NUMERIC(5,1),
  mileage      INTEGER,
  notes        TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Kilometerstand-Verlauf ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS werkstatt_mileage_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "vehicleId" UUID NOT NULL REFERENCES werkstatt_vehicles(id) ON DELETE CASCADE,
  "invoiceId" UUID REFERENCES werkstatt_invoices(id) ON DELETE SET NULL,
  date        DATE,
  mileage     INTEGER NOT NULL,
  source      werkstatt_mileage_source NOT NULL DEFAULT 'MANUAL',
  notes       TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indizes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_werkstatt_invoices_vehicle   ON werkstatt_invoices("vehicleId");
CREATE INDEX IF NOT EXISTS idx_werkstatt_invoices_date      ON werkstatt_invoices("invoiceDate");
CREATE INDEX IF NOT EXISTS idx_werkstatt_invoices_anomaly   ON werkstatt_invoices("hasAnomalies");
CREATE INDEX IF NOT EXISTS idx_werkstatt_positions_invoice  ON werkstatt_invoice_positions("invoiceId");
CREATE INDEX IF NOT EXISTS idx_werkstatt_positions_anomaly  ON werkstatt_invoice_positions("isAnomaly");
CREATE INDEX IF NOT EXISTS idx_werkstatt_inspections_vehicle ON werkstatt_inspections("vehicleId");
CREATE INDEX IF NOT EXISTS idx_werkstatt_mileage_vehicle    ON werkstatt_mileage_history("vehicleId");
CREATE INDEX IF NOT EXISTS idx_werkstatt_tire_vehicle       ON werkstatt_tire_history("vehicleId");

-- ── updatedAt-Trigger für Fahrzeuge und Rechnungen ─────────────────────────
CREATE OR REPLACE FUNCTION werkstatt_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS werkstatt_vehicles_updated_at ON werkstatt_vehicles;
CREATE TRIGGER werkstatt_vehicles_updated_at
  BEFORE UPDATE ON werkstatt_vehicles
  FOR EACH ROW EXECUTE FUNCTION werkstatt_set_updated_at();

DROP TRIGGER IF EXISTS werkstatt_invoices_updated_at ON werkstatt_invoices;
CREATE TRIGGER werkstatt_invoices_updated_at
  BEFORE UPDATE ON werkstatt_invoices
  FOR EACH ROW EXECUTE FUNCTION werkstatt_set_updated_at();

-- ── Row Level Security (optional, aber empfohlen) ──────────────────────────
-- Deaktiviert für Service-Role-Zugriff vom Backend; aktiviere nach Bedarf
-- ALTER TABLE werkstatt_vehicles ENABLE ROW LEVEL SECURITY;
