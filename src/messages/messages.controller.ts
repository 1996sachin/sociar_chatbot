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
} from '@nestjs/common';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessageService) { }

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
    const data = createMessageValidator.safeParse(body);
    console.log(body);

    if (!data.success) {
      throw new BadRequestException(data.error.format());
    }
    const createdMessage = await this.messagesService.createMessage(body);
    return {
      message: 'Message created successfully',
      data: createdMessage,
    };
  }

  @Get()
  findAll() {
    return this.messagesService.all();
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
