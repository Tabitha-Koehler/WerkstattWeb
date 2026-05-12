import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Invoice } from './invoice.entity';
import { Inspection } from './inspection.entity';

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  licensePlate: string;

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
