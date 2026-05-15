import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { Invoice } from './invoice.entity';

export enum TireAxle {
  FRONT = 'FRONT',
  REAR = 'REAR',
  FRONT_LEFT = 'FRONT_LEFT',
  FRONT_RIGHT = 'FRONT_RIGHT',
  REAR_LEFT = 'REAR_LEFT',
  REAR_RIGHT = 'REAR_RIGHT',
  ALL = 'ALL',
}

export enum TireSeason {
  SUMMER = 'SUMMER',
  WINTER = 'WINTER',
  ALL_SEASON = 'ALL_SEASON',
}

@Entity('werkstatt_tire_history')
export class TireHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Vehicle, (v) => v.tireHistory, { nullable: false, onDelete: 'CASCADE' })
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
  changeDate: string;

  @Column({ type: 'enum', enum: TireAxle, nullable: true })
  axle: TireAxle;

  @Column({ type: 'enum', enum: TireSeason, nullable: true })
  season: TireSeason;

  @Column({ nullable: true })
  tireSize: string;

  @Column({ nullable: true })
  manufacturer: string;

  @Column({ nullable: true })
  dot: string;

  @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
  profileDepth: number;

  @Column({ nullable: true })
  mileage: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;
}
