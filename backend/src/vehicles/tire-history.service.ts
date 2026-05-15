import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TireHistory } from '../database/entities/tire-history.entity';

@Injectable()
export class TireHistoryService {
  constructor(
    @InjectRepository(TireHistory) private repo: Repository<TireHistory>,
  ) {}

  findByVehicle(vehicleId: string): Promise<TireHistory[]> {
    return this.repo.find({
      where: { vehicleId },
      order: { changeDate: 'DESC' },
    });
  }

  async create(vehicleId: string, data: Partial<TireHistory>): Promise<TireHistory> {
    const entry = this.repo.create({ ...data, vehicleId });
    return this.repo.save(entry);
  }

  async update(id: string, data: Partial<TireHistory>): Promise<TireHistory> {
    const entry = await this.repo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException(`Reifeneintrag ${id} nicht gefunden`);
    Object.assign(entry, data);
    return this.repo.save(entry);
  }

  async delete(id: string): Promise<void> {
    const entry = await this.repo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException(`Reifeneintrag ${id} nicht gefunden`);
    await this.repo.remove(entry);
  }
}
