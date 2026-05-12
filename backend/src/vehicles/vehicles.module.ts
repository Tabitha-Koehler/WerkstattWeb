import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { Vehicle } from '../database/entities/vehicle.entity';
import { Inspection } from '../database/entities/inspection.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Vehicle, Inspection])],
  controllers: [VehiclesController],
  providers: [VehiclesService],
  exports: [VehiclesService],
})
export class VehiclesModule {}
