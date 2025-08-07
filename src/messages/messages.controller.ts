import { InjectModel } from '@nestjs/mongoose';
import { createMessageValidator } from './message.validator';
import { MessageService } from './messages.service';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { User, UserDocument } from 'src/users/entities/user.entity';
import mongoose, { Model } from 'mongoose';
import { ApiQuery } from '@nestjs/swagger';

@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessageService,
    @InjectModel(User.name) private readonly UserModel: Model<UserDocument>,
  ) {}

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
    const data = await createMessageValidator(this.UserModel).parseAsync(body);

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
  findAll(
    @Param('conversationId') conversationId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.messagesService.fetchMessages(conversationId, page, limit);
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
