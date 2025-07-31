import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ConversationParticipantService } from './conversation-participant.service';

@Controller('conversation-participant')
export class ConversationParticipantController {
  constructor(
    private readonly conversationParticipantService: ConversationParticipantService,
  ) { }

  @Post()
  create(@Body() body: unknown) {
    return this.conversationParticipantService.save(body);
  }

  @Get()
  findAll() {
    return this.conversationParticipantService.all();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.conversationParticipantService.find(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.conversationParticipantService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.conversationParticipantService.delete(id);
  }
}
