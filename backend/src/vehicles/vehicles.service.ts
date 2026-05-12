import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from '../database/entities/vehicle.entity';
import { Inspection } from '../database/entities/inspection.entity';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle) private vehicleRepo: Repository<Vehicle>,
    @InjectRepository(Inspection) private inspectionRepo: Repository<Inspection>,
  ) {}

  async findAll(): Promise<Vehicle[]> {
    return this.vehicleRepo.find({ order: { licensePlate: 'ASC' } });
  }

  async findOne(id: string): Promise<Vehicle> {
    const vehicle = await this.vehicleRepo.findOne({ where: { id } });
    if (!vehicle) throw new NotFoundException(`Fahrzeug ${id} nicht gefunden`);
    return vehicle;
  }

  async create(data: Partial<Vehicle>): Promise<Vehicle> {
    const existing = await this.vehicleRepo.findOne({ where: { licensePlate: data.licensePlate } });
    if (existing) throw new ConflictException(`Kennzeichen ${data.licensePlate} bereits vorhanden`);
    const vehicle = this.vehicleRepo.create(data);
    return this.vehicleRepo.save(vehicle);
  }

  async update(id: string, data: Partial<Vehicle>): Promise<Vehicle> {
    const vehicle = await this.findOne(id);
    Object.assign(vehicle, data);
    return this.vehicleRepo.save(vehicle);
  }

  async delete(id: string): Promise<void> {
    const vehicle = await this.findOne(id);
    await this.vehicleRepo.remove(vehicle);
  }

  async getLatestInspections(vehicleId: string): Promise<Record<string, Inspection>> {
    const types = ['SP', 'HU', 'AU'];
    const result: Record<string, Inspection> = {};

    for (const type of types) {
      const insp = await this.inspectionRepo.findOne({
        where: { vehicleId, type: type as any },
        order: { inspectionDate: 'DESC' },
      });
      if (insp) result[type] = insp;
    }

    return result;
  }

  async getUpcomingInspections(daysBefore = 60): Promise<any[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysBefore);

    const inspections = await this.inspectionRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.vehicle', 'vehicle')
      .where('i.nextDueDate IS NOT NULL')
      .andWhere('i.nextDueDate <= :cutoff', { cutoff: cutoffDate.toISOString().split('T')[0] })
      .orderBy('i.nextDueDate', 'ASC')
      .getMany();

    return inspections;
  }
}
