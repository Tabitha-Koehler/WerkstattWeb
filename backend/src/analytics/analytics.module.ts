import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { Invoice } from '../database/entities/invoice.entity';
import { MileageHistory } from '../database/entities/mileage-history.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, MileageHistory])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
