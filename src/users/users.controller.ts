import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  create(@Body() body: unknown) {
    return this.usersService.save(body);
  }

  @Get()
  findAll() {
    return this.usersService.all();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.find(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    return this.usersService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.delete(id);
  }
}
