import {
  Controller,
  Get,
  Post,
  Body,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { createConversationValidator } from './conversation.validator';

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
}
