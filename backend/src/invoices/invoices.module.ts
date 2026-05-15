import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { Invoice } from '../database/entities/invoice.entity';
import { Vehicle } from '../database/entities/vehicle.entity';
import { InvoicePosition } from '../database/entities/invoice-position.entity';
import { Inspection } from '../database/entities/inspection.entity';
import { OperatingSupply } from '../database/entities/operating-supply.entity';
import { MileageHistory } from '../database/entities/mileage-history.entity';
import { PdfParserModule } from '../pdf-parser/pdf-parser.module';
import { AiAnalysisModule } from '../ai-analysis/ai-analysis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Invoice, Vehicle, InvoicePosition, Inspection, OperatingSupply, MileageHistory]),
    PdfParserModule,
    AiAnalysisModule,
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
