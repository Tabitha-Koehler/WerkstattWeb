import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { TireHistoryService } from './tire-history.service';
import { MileageHistoryService } from './mileage-history.service';
import { Vehicle } from '../database/entities/vehicle.entity';
import { Inspection } from '../database/entities/inspection.entity';
import { TireHistory } from '../database/entities/tire-history.entity';
import { MileageHistory } from '../database/entities/mileage-history.entity';
import { InvoicePosition } from '../database/entities/invoice-position.entity';
import { OperatingSupply } from '../database/entities/operating-supply.entity';
import { Invoice } from '../database/entities/invoice.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Vehicle, Inspection, TireHistory, MileageHistory, InvoicePosition, OperatingSupply, Invoice])],
  controllers: [VehiclesController],
  providers: [VehiclesService, TireHistoryService, MileageHistoryService],
  exports: [VehiclesService, TireHistoryService, MileageHistoryService],
})
export class VehiclesModule {}
