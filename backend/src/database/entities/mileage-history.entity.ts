import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { Invoice } from './invoice.entity';

export enum MileageSource {
  MANUAL = 'MANUAL',
  INVOICE = 'INVOICE',
  INSPECTION = 'INSPECTION',
}

@Entity('mileage_history')
export class MileageHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Vehicle, (v) => v.mileageHistory, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @Column()
  vehicleId: string;

  @ManyToOne(() => Invoice, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;

  @Column({ nullable: true })
  invoiceId: string;

  @Column({ type: 'date', nullable: true })
  date: string;

  @Column()
  mileage: number;

  @Column({ type: 'enum', enum: MileageSource, default: MileageSource.MANUAL })
  source: MileageSource;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;
}
