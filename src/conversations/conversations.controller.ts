import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import {
  createConversationValidator,
  updateConversationValidator,
} from './conversation.validator';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  async create(@Body() body: unknown): Promise<{ message: string; data: any }> {
    const data = createConversationValidator.safeParse(body);

    if (!data.success) {
      throw new BadRequestException(data.error.format());
    }

    const conversation = await this.conversationsService.save(data.data);
    return {
      message: 'Chat created successfully',
      data: conversation,
    };
  }

  @Get()
  findAll(@Query('page') page: string, @Query('limit') limit: string) {
    return this.conversationsService.fetchConversations(page, limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.conversationsService.find(id);
  }

  @Patch(':id')
  async patch(
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<{ message: string; data: any }> {
    const data = updateConversationValidator.safeParse(body);
    if (!data.success) {
      throw new BadRequestException(data.error.format());
    }
    const updated = await this.conversationsService.update(id, data.data);
    return {
      message: 'Chat updated successfully',
      data: updated,
    };
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
  ): Promise<{ message: string; data: any }> {
    const deleteChat = await this.conversationsService.delete(id);

    return {
      message: 'Message deleted successfully',
      data: deleteChat,
    };
  }
}
