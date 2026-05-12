export interface Vehicle {
  id: string;
  licensePlate: string;
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
