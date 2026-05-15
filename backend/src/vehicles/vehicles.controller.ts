import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { TireHistoryService } from './tire-history.service';
import { MileageHistoryService } from './mileage-history.service';
import { Vehicle } from '../database/entities/vehicle.entity';

@Controller('vehicles')
export class VehiclesController {
  constructor(
    private readonly vehiclesService: VehiclesService,
    private readonly tireHistoryService: TireHistoryService,
    private readonly mileageHistoryService: MileageHistoryService,
  ) {}

  @Get()
  findAll() { return this.vehiclesService.findAll(); }

  @Get('upcoming-inspections')
  getUpcomingInspections(@Query('days') days?: string) {
    return this.vehiclesService.getUpcomingInspections(days ? parseInt(days) : 60);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.vehiclesService.findOne(id); }

  @Get(':id/inspections')
  getLatestInspections(@Param('id') id: string) {
    return this.vehiclesService.getLatestInspections(id);
  }

  @Get(':id/history')
  getTimeline(@Param('id') id: string) {
    return this.vehiclesService.getTimeline(id);
  }

  @Post('enrich-from-invoices')
  enrichAllFromInvoices() {
    return this.vehiclesService.enrichFromInvoices();
  }

  @Post(':id/enrich-from-invoices')
  enrichFromInvoices(@Param('id') id: string) {
    return this.vehiclesService.enrichFromInvoices(id);
  }

  @Post()
  create(@Body() body: Partial<Vehicle>) { return this.vehiclesService.create(body); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: Partial<Vehicle>) {
    return this.vehiclesService.update(id, body);
  }

  @Delete(':id')
  delete(@Param('id') id: string) { return this.vehiclesService.delete(id); }

  // ── Reifenhistorie ─────────────────────────────────────────
  @Get(':id/tires')
  getTires(@Param('id') vehicleId: string) {
    return this.tireHistoryService.findByVehicle(vehicleId);
  }

  @Post(':id/tires')
  addTire(@Param('id') vehicleId: string, @Body() body: any) {
    return this.tireHistoryService.create(vehicleId, body);
  }

  @Put(':id/tires/:tireId')
  updateTire(@Param('tireId') tireId: string, @Body() body: any) {
    return this.tireHistoryService.update(tireId, body);
  }

  @Delete(':id/tires/:tireId')
  deleteTire(@Param('tireId') tireId: string) {
    return this.tireHistoryService.delete(tireId);
  }

  // ── Kilometerstände ────────────────────────────────────────
  @Get(':id/mileage')
  getMileage(@Param('id') vehicleId: string) {
    return this.mileageHistoryService.findByVehicle(vehicleId);
  }

  @Post(':id/mileage')
  addMileage(@Param('id') vehicleId: string, @Body() body: any) {
    return this.mileageHistoryService.create(vehicleId, body);
  }

  @Put(':id/mileage/:mileageId')
  updateMileage(@Param('mileageId') mileageId: string, @Body() body: any) {
    return this.mileageHistoryService.update(mileageId, body);
  }

  @Delete(':id/mileage/:mileageId')
  deleteMileage(@Param('mileageId') mileageId: string) {
    return this.mileageHistoryService.delete(mileageId);
  }
}
