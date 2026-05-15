import { Controller, Get, Param, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { FraudDetectionService } from '../fraud-detection/fraud-detection.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly fraudService: FraudDetectionService,
  ) {}

  @Get('workshops')
  getWorkshops() {
    return this.analyticsService.getWorkshopStats();
  }

  @Get('vehicles/costs')
  getVehicleCosts() {
    return this.analyticsService.getVehicleCosts();
  }

  @Get('vehicles/:id/cost-per-km')
  getCostPerKm(@Param('id') id: string) {
    return this.analyticsService.getCostPerKm(id);
  }

  @Get('monthly')
  getMonthlyCosts(@Query('vehicleId') vehicleId?: string) {
    return this.analyticsService.getMonthlyCosts(vehicleId);
  }

  // ── Betrugs- und Plausibilitätsprüfung ───────────────────────────────────
  @Get('fraud-alerts')
  getFraudAlerts() {
    return this.fraudService.getAllAlerts();
  }

  @Get('repeated-repairs')
  getRepeatedRepairs(@Query('days') days?: string) {
    return this.fraudService.getRepeatedRepairs(days ? parseInt(days, 10) : 90);
  }

  @Get('price-anomalies')
  getPriceAnomalies(@Query('minDeviation') minDev?: string) {
    return this.fraudService.getPriceAnomalies(minDev ? parseInt(minDev, 10) : 80);
  }

  @Get('workshop-alerts')
  getWorkshopAlerts() {
    return this.fraudService.getWorkshopAlerts();
  }
}
