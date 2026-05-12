import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { InspectionsService } from './inspections.service';
import { Inspection } from '../database/entities/inspection.entity';

@Controller('inspections')
export class InspectionsController {
  constructor(private readonly inspectionsService: InspectionsService) {}

  @Get('overdue')
  getOverdue() {
    return this.inspectionsService.getOverdue();
  }

  @Get('due-soon')
  getDueSoon(@Query('days') days?: string) {
    return this.inspectionsService.getDueSoon(days ? parseInt(days) : 60);
  }

  @Get('vehicle/:vehicleId')
  findByVehicle(@Param('vehicleId') vehicleId: string) {
    return this.inspectionsService.findByVehicle(vehicleId);
  }

  @Get('vehicle/:vehicleId/latest')
  findLatestPerType(@Param('vehicleId') vehicleId: string) {
    return this.inspectionsService.findLatestPerType(vehicleId);
  }

  @Post()
  create(@Body() body: Partial<Inspection>) {
    return this.inspectionsService.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: Partial<Inspection>) {
    return this.inspectionsService.update(id, body);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.inspectionsService.delete(id);
  }
}
