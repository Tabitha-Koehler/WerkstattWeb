import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { Vehicle } from '../database/entities/vehicle.entity';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  findAll() {
    return this.vehiclesService.findAll();
  }

  @Get('upcoming-inspections')
  getUpcomingInspections(@Query('days') days?: string) {
    return this.vehiclesService.getUpcomingInspections(days ? parseInt(days) : 60);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vehiclesService.findOne(id);
  }

  @Get(':id/inspections')
  getLatestInspections(@Param('id') id: string) {
    return this.vehiclesService.getLatestInspections(id);
  }

  @Post()
  create(@Body() body: Partial<Vehicle>) {
    return this.vehiclesService.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: Partial<Vehicle>) {
    return this.vehiclesService.update(id, body);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.vehiclesService.delete(id);
  }
}
