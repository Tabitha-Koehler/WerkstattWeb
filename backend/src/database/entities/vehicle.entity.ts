import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Invoice } from './invoice.entity';
import { Inspection } from './inspection.entity';
import { TireHistory } from './tire-history.entity';
import { MileageHistory } from './mileage-history.entity';

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  licensePlate: string;

  @Column({ nullable: true })
  vehicleNumber: string;

  @Column({ nullable: true })
  vin: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  vehicleType: string;

  @Column({ nullable: true })
  manufacturer: string;

  @Column({ nullable: true })
  model: string;

  @Column({ nullable: true })
  year: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @OneToMany(() => Invoice, (invoice) => invoice.vehicle, { cascade: false })
  invoices: Invoice[];

  @OneToMany(() => Inspection, (inspection) => inspection.vehicle, { cascade: false })
  inspections: Inspection[];

  @OneToMany(() => TireHistory, (t) => t.vehicle, { cascade: false })
  tireHistory: TireHistory[];

  @OneToMany(() => MileageHistory, (m) => m.vehicle, { cascade: false })
  mileageHistory: MileageHistory[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
