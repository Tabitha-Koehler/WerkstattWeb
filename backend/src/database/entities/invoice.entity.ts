import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { InvoicePosition } from './invoice-position.entity';
import { Inspection } from './inspection.entity';
import { OperatingSupply } from './operating-supply.entity';

@Entity('werkstatt_invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Vehicle, (vehicle) => vehicle.invoices, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @Column({ nullable: true })
  vehicleId: string;

  @Column({ nullable: true })
  workshopName: string;

  @Column({ nullable: true })
  invoiceNumber: string;

  @Column({ type: 'date', nullable: true })
  invoiceDate: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalAmount: number;

  @Column({ nullable: true })
  pdfPath: string;

  @Column({ nullable: true })
  originalFilename: string;

  @Column({ type: 'text', nullable: true })
  rawText: string;

  @Column({ type: 'text', nullable: true })
  repairContext: string;

  @Column({ type: 'text', nullable: true })
  aiSummary: string;

  @Column({ default: false })
  hasAnomalies: boolean;

  @Column({ default: false })
  isWarehouse: boolean;

  @Column({ default: false })
  processingError: boolean;

  @Column({ type: 'text', nullable: true })
  processingErrorMessage: string;

  @OneToMany(() => InvoicePosition, (pos) => pos.invoice, { cascade: true, eager: false })
  positions: InvoicePosition[];

  @OneToMany(() => Inspection, (insp) => insp.invoice, { cascade: true, eager: false })
  inspections: Inspection[];

  @OneToMany(() => OperatingSupply, (sup) => sup.invoice, { cascade: true, eager: false })
  operatingSupplies: OperatingSupply[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
