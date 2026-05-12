import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { Invoice } from './invoice.entity';

export enum InspectionType {
  SP = 'SP',
  HU = 'HU',
  AU = 'AU',
}

@Entity('inspections')
export class Inspection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Vehicle, (vehicle) => vehicle.inspections, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @Column({ nullable: true })
  vehicleId: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.inspections, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;

  @Column({ nullable: true })
  invoiceId: string;

  @Column({ type: 'enum', enum: InspectionType })
  type: InspectionType;

  @Column({ type: 'date', nullable: true })
  inspectionDate: string;

  @Column({ type: 'date', nullable: true })
  nextDueDate: string;

  @Column({ nullable: true })
  mileage: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;
}
