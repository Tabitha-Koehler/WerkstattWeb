import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Invoice } from './invoice.entity';

export enum PositionCategory {
  REPAIR = 'REPAIR',
  INSPECTION = 'INSPECTION',
  BETRIEBSMITTEL = 'BETRIEBSMITTEL',
  LABOR = 'LABOR',
  PARTS = 'PARTS',
  TOOLS = 'TOOLS',
  OTHER = 'OTHER',
}

@Entity('invoice_positions')
export class InvoicePosition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.positions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;

  @Column()
  invoiceId: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true })
  quantity: number;

  @Column({ nullable: true })
  unit: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalPrice: number;

  @Column({ type: 'enum', enum: PositionCategory, default: PositionCategory.OTHER })
  category: PositionCategory;

  @Column({ default: false })
  isAnomaly: boolean;

  @Column({ type: 'text', nullable: true })
  anomalyReason: string;
}
