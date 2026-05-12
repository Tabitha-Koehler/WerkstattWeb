import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inspection, InspectionType } from '../database/entities/inspection.entity';

@Injectable()
export class InspectionsService {
  constructor(
    @InjectRepository(Inspection)
    private inspectionRepo: Repository<Inspection>,
  ) {}

  async findByVehicle(vehicleId: string): Promise<Inspection[]> {
    return this.inspectionRepo.find({
      where: { vehicleId },
      order: { inspectionDate: 'DESC' },
      relations: ['invoice'],
    });
  }

  async findLatestPerType(vehicleId: string): Promise<Record<string, Inspection | null>> {
    const result: Record<string, Inspection | null> = { SP: null, HU: null, AU: null };
    for (const type of Object.values(InspectionType)) {
      const insp = await this.inspectionRepo.findOne({
        where: { vehicleId, type },
        order: { inspectionDate: 'DESC' },
        relations: ['invoice'],
      });
      result[type] = insp || null;
    }
    return result;
  }

  async create(data: Partial<Inspection>): Promise<Inspection> {
    const insp = this.inspectionRepo.create(data);
    return this.inspectionRepo.save(insp);
  }

  async update(id: string, data: Partial<Inspection>): Promise<Inspection> {
    const insp = await this.inspectionRepo.findOne({ where: { id } });
    if (!insp) throw new NotFoundException(`Prüfung ${id} nicht gefunden`);
    Object.assign(insp, data);
    return this.inspectionRepo.save(insp);
  }

  async delete(id: string): Promise<void> {
    const insp = await this.inspectionRepo.findOne({ where: { id } });
    if (!insp) throw new NotFoundException(`Prüfung ${id} nicht gefunden`);
    await this.inspectionRepo.remove(insp);
  }

  async getOverdue(): Promise<Inspection[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.inspectionRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.vehicle', 'vehicle')
      .where('i.nextDueDate IS NOT NULL')
      .andWhere('i.nextDueDate < :today', { today })
      .orderBy('i.nextDueDate', 'ASC')
      .getMany();
  }

  async getDueSoon(days = 60): Promise<Inspection[]> {
    const today = new Date().toISOString().split('T')[0];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    return this.inspectionRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.vehicle', 'vehicle')
      .where('i.nextDueDate IS NOT NULL')
      .andWhere('i.nextDueDate >= :today', { today })
      .andWhere('i.nextDueDate <= :cutoff', { cutoff: cutoffStr })
      .orderBy('i.nextDueDate', 'ASC')
      .getMany();
  }
}
