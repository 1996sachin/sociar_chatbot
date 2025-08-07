import {
  Controller,
  Get,
  Post,
  Body,
  BadRequestException,
  Query,
  Param,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { createConversationValidator } from './conversation.validator';
import { ApiQuery } from '@nestjs/swagger';

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

  @Get(':id')
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number',
    example: '1',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: '10',
    description: 'Number of data to be fetched',
  })
  findAll(
    @Param('id') id: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.conversationsService.fetchConversations(id, page, limit);
  }
}
