import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { VehiclesModule } from './vehicles/vehicles.module';
import { InvoicesModule } from './invoices/invoices.module';
import { InspectionsModule } from './inspections/inspections.module';
import { FileWatcherModule } from './file-watcher/file-watcher.module';
import { PdfParserModule } from './pdf-parser/pdf-parser.module';
import { AiAnalysisModule } from './ai-analysis/ai-analysis.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { Vehicle } from './database/entities/vehicle.entity';
import { Invoice } from './database/entities/invoice.entity';
import { InvoicePosition } from './database/entities/invoice-position.entity';
import { Inspection } from './database/entities/inspection.entity';
import { OperatingSupply } from './database/entities/operating-supply.entity';
import { TireHistory } from './database/entities/tire-history.entity';
import { MileageHistory } from './database/entities/mileage-history.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '../.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => {
        const dbUrl = config.get<string>('database.url');

        const base: Partial<TypeOrmModuleOptions> = {
          type: 'postgres',
          entities: [Vehicle, Invoice, InvoicePosition, Inspection, OperatingSupply, TireHistory, MileageHistory],
          synchronize: true,
          logging: false,
        };

        if (dbUrl) {
          // Supabase / Railway: DATABASE_URL mit SSL
          return {
            ...base,
            type: 'postgres',
            url: dbUrl,
            ssl: { rejectUnauthorized: false },
          } as TypeOrmModuleOptions;
        }

        // Lokal: einzelne Credentials
        return {
          ...base,
          type: 'postgres',
          host: config.get('database.host'),
          port: config.get<number>('database.port'),
          username: config.get('database.username'),
          password: config.get('database.password'),
          database: config.get('database.name'),
        } as TypeOrmModuleOptions;
      },
    }),
    VehiclesModule,
    InvoicesModule,
    InspectionsModule,
    FileWatcherModule,
    PdfParserModule,
    AiAnalysisModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
