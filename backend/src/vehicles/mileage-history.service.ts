import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MileageHistory } from '../database/entities/mileage-history.entity';

@Injectable()
export class MileageHistoryService {
  constructor(
    @InjectRepository(MileageHistory) private repo: Repository<MileageHistory>,
  ) {}

  findByVehicle(vehicleId: string): Promise<MileageHistory[]> {
    return this.repo.find({
      where: { vehicleId },
      order: { date: 'DESC' },
    });
  }

  async getLatest(vehicleId: string): Promise<MileageHistory | null> {
    return this.repo.findOne({
      where: { vehicleId },
      order: { mileage: 'DESC' },
    });
  }

  async create(vehicleId: string, data: Partial<MileageHistory>): Promise<MileageHistory> {
    const entry = this.repo.create({ ...data, vehicleId });
    return this.repo.save(entry);
  }

  async update(id: string, data: Partial<MileageHistory>): Promise<MileageHistory> {
    const entry = await this.repo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException(`Kilometereintrag ${id} nicht gefunden`);
    Object.assign(entry, data);
    return this.repo.save(entry);
  }

  async delete(id: string): Promise<void> {
    const entry = await this.repo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException(`Kilometereintrag ${id} nicht gefunden`);
    await this.repo.remove(entry);
  }
}
