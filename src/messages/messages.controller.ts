import { InjectModel } from '@nestjs/mongoose';
import {
  createMessageValidator,
  updateMessageValidator,
} from './message.validator';
import { MessageService } from './messages.service';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { User, UserDocument } from 'src/users/entities/user.entity';
import { Model } from 'mongoose';

@Controller('messages')
export class MessagesController {
  constructor(
    private readonly messagesService: MessageService,
    @InjectModel(User.name) private readonly UserModel: Model<UserDocument>,
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
  findAll(
    @Param('conversationId') conversationId: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    return this.messagesService.fetchMessages(page, limit, conversationId);
  }
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.messagesService.find(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const data = updateMessageValidator.safeParse(body);
    if (!data.success) {
      throw new BadRequestException(data.error.format());
    }
    const updated = await this.messagesService.update(id, data.data);

    return {
      message: 'Message updated successfully',
      data: updated,
    };
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
  ): Promise<{ message: string; data: any }> {
    const deletedMessage = await this.messagesService.delete(id);

    return {
      message: 'Message deleted successfully',
      data: deletedMessage,
    };
  }
}
