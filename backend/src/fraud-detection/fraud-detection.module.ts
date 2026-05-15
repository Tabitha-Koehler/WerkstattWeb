import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoicePosition } from '../database/entities/invoice-position.entity';
import { Invoice } from '../database/entities/invoice.entity';
import { FraudDetectionService } from './fraud-detection.service';

@Module({
  imports: [TypeOrmModule.forFeature([InvoicePosition, Invoice])],
  providers: [FraudDetectionService],
  exports: [FraudDetectionService],
})
export class FraudDetectionModule {}
