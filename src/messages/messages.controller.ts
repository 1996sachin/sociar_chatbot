import {
  createMessageValidator,
  fetchMessageValidator,
} from './message.validator';
import { MessageService } from './messages.service';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import mongoose from 'mongoose';
import { ApiQuery } from '@nestjs/swagger';
import { UsersService } from 'src/users/users.service';
import { ConversationsService } from 'src/conversations/conversations.service';

@Controller('messages')
export class MessagesController {
  constructor(
    @Inject()
    private readonly messagesService: MessageService,
    @Inject()
    private readonly userService: UsersService,
    @Inject()
    private readonly conversationService: ConversationsService,
  ) { }

  @Post()
  async create(
    @Body()
    body: {
      senderId: string;
      recieverId: string;
      content: string;
      conversation: string;
      messageStatus?: string;
    },
  ): Promise<{ message: string; data: any }> {
    const data = await createMessageValidator(
      this.userService.getRepository(),
    ).parseAsync(body);

    const createdMessage = await this.messagesService.createMessage({
      senderId: data.senderId,
      content: data.content,
      recieverId: data.recieverId,
      conversationId: data.conversation,
    });
    return {
      message: 'Message created successfully',
      data: createdMessage,
    };
  }

  @Get(':conversationId')
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
  async findAll(
    @Param('conversationId') conversationId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const data = { conversationId, page, limit };
    const parsedData = await fetchMessageValidator(
      this.conversationService.getRepository(),
    ).safeParseAsync(data);
    if (!parsedData.success) {
      throw new BadRequestException(parsedData.error.format());
    }
    return this.messagesService.fetchMessages(
      parsedData.data.conversationId,
      parsedData.data.page,
      parsedData.data.limit,
    );
  }

  @Delete()
  async dropDb() {
    await mongoose.connect(process.env.DATABASE_URL!);

    const db = mongoose.connection.db;

    await db?.dropCollection('conversations');
    await db?.dropCollection('messages');
    await db?.dropCollection('conversationparticipants');
    await db?.dropCollection('users');
    return {
      message: 'All four collection dropped successfully',
    };
  }
}
