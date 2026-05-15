import { Controller, Get, Param, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

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
}
