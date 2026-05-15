import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { FraudDetectionService } from '../fraud-detection/fraud-detection.service';
import { Invoice } from '../database/entities/invoice.entity';
import { InvoicePosition } from '../database/entities/invoice-position.entity';
import { MileageHistory } from '../database/entities/mileage-history.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Invoice, InvoicePosition, MileageHistory])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, FraudDetectionService],
  exports: [AnalyticsService, FraudDetectionService],
})
export class AnalyticsModule {}
