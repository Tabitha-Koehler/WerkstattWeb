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

@Entity('werkstatt_operating_supplies')
export class OperatingSupply {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Vehicle, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @Column({ nullable: true })
  vehicleId: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.operatingSupplies, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;

  @Column({ nullable: true })
  invoiceId: string;

  @Column()
  type: string;

  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true })
  quantity: number;

  @Column({ nullable: true })
  unit: string;

  @Column({ type: 'date', nullable: true })
  date: string;

  @CreateDateColumn()
  createdAt: Date;
}
