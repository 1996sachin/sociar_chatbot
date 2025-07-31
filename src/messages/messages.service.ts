import { Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import { BaseService } from 'src/base.service';
import { MessageDocument, Message } from './entities/message.entity';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class MessageService extends BaseService<MessageDocument> {
  constructor(
    @InjectModel(Message.name)
    private readonly MessageModel: Model<MessageDocument>,
  ) {
    super(MessageModel);
  }
}
