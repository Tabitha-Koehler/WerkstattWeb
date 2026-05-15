export interface Vehicle {
  id: string;
  licensePlate: string;
  vehicleNumber?: string;
  vin?: string;
  name?: string;
  vehicleType?: string;
  manufacturer?: string;
  model?: string;
  year?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type InspectionType = 'SP' | 'HU' | 'AU';
export type PositionCategory = 'REPAIR' | 'INSPECTION' | 'BETRIEBSMITTEL' | 'LABOR' | 'PARTS' | 'TOOLS' | 'OTHER';
export type TireAxle = 'FRONT' | 'REAR' | 'FRONT_LEFT' | 'FRONT_RIGHT' | 'REAR_LEFT' | 'REAR_RIGHT' | 'ALL';
export type TireSeason = 'SUMMER' | 'WINTER' | 'ALL_SEASON';
export type MileageSource = 'MANUAL' | 'INVOICE' | 'INSPECTION';

export interface Inspection {
  id: string;
  vehicleId?: string;
  invoiceId?: string;
  type: InspectionType;
  inspectionDate?: string;
  nextDueDate?: string;
  mileage?: number;
  notes?: string;
  createdAt: string;
  vehicle?: Vehicle;
  invoice?: Invoice;
}

export interface TireHistory {
  id: string;
  vehicleId: string;
  invoiceId?: string;
  changeDate?: string;
  axle?: TireAxle;
  season?: TireSeason;
  tireSize?: string;
  manufacturer?: string;
  dot?: string;
  profileDepth?: number;
  mileage?: number;
  notes?: string;
  createdAt: string;
}

export interface MileageHistory {
  id: string;
  vehicleId: string;
  invoiceId?: string;
  date?: string;
  mileage: number;
  source: MileageSource;
  notes?: string;
  createdAt: string;
}

export interface InvoicePosition {
  id: string;
  invoiceId: string;
  description: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  totalPrice?: number;
  category: PositionCategory;
  isAnomaly: boolean;
  anomalyReason?: string;
}

export interface OperatingSupply {
  id: string;
  vehicleId?: string;
  invoiceId?: string;
  type: string;
  quantity?: number;
  unit?: string;
  date?: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  vehicleId?: string;
  vehicle?: Vehicle;
  workshopName?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  totalAmount?: number;
  pdfPath?: string;
  originalFilename?: string;
  repairContext?: string;
  aiSummary?: string;
  hasAnomalies: boolean;
  isWarehouse: boolean;
  processingError: boolean;
  processingErrorMessage?: string;
  positions?: InvoicePosition[];
  inspections?: Inspection[];
  operatingSupplies?: OperatingSupply[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceStats {
  total: number;
  withAnomalies: number;
  warehouse: number;
  errors: number;
}

export interface LatestInspections {
  SP?: Inspection;
  HU?: Inspection;
  AU?: Inspection;
}

export const TIRE_AXLE_LABELS: Record<TireAxle, string> = {
  FRONT: 'Vorderachse',
  REAR: 'Hinterachse',
  FRONT_LEFT: 'Vorne links',
  FRONT_RIGHT: 'Vorne rechts',
  REAR_LEFT: 'Hinten links',
  REAR_RIGHT: 'Hinten rechts',
  ALL: 'Alle Achsen',
};

export const TIRE_SEASON_LABELS: Record<TireSeason, string> = {
  SUMMER: 'Sommerreifen',
  WINTER: 'Winterreifen',
  ALL_SEASON: 'Ganzjahresreifen',
};

export const MILEAGE_SOURCE_LABELS: Record<MileageSource, string> = {
  MANUAL: 'Manuell',
  INVOICE: 'Aus Rechnung',
  INSPECTION: 'Aus Prüfung',
};

export interface ReprocessStatus {
  running: boolean;
  total: number;
  done: number;
  anomaliesFound: number;
  errors: number;
  startedAt: string | null;
  finishedAt: string | null;
  currentFile: string;
}

export type TimelineEventType = 'repair' | 'inspection' | 'supply' | 'tire' | 'mileage' | 'invoice';

export interface TimelineEvent {
  date: string | null;
  type: TimelineEventType;
  description: string;
  detail?: string;
  invoiceId?: string;
  severity: 'normal' | 'warning';
}

export interface WorkshopStats {
  workshopName: string;
  invoiceCount: number;
  totalAmount: number;
  avgAmount: number;
  anomalyCount: number;
  anomalyRate: number;
}

export interface VehicleCostStats {
  vehicleId: string;
  licensePlate: string;
  invoiceCount: number;
  totalAmount: number;
  firstInvoice: string | null;
  lastInvoice: string | null;
}

export interface CostPerKm {
  vehicleId: string;
  totalAmount: number;
  invoiceCount: number;
  minKm: number | null;
  maxKm: number | null;
  kmDriven: number | null;
  costPerKm: number | null;
}

export interface MonthlyCost {
  month: string;
  totalAmount: number;
  invoiceCount: number;
}
