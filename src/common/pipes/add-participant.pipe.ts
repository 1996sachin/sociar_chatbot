import { Injectable, PipeTransform } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from 'src/users/entities/user.entity';
import { ChatDocument, Conversation } from 'src/conversations/entities/conversation.entity';
import { addParticipantsDto, addParticipantsSchema } from 'src/chat/chat.validator';

@Injectable()
export class AddParticipantsValidationPipe implements PipeTransform {
  constructor(
    @InjectModel(User.name) private readonly UserModel: Model<UserDocument>,
    @InjectModel(Conversation.name) private readonly ConversationModel: Model<ChatDocument>,
  ) { }

  async transform(value: any): Promise<addParticipantsDto> {
    const schema = addParticipantsSchema(this.UserModel, this.ConversationModel);

    const parsed = await schema.safeParseAsync(value);
    if (!parsed.success) {
      throw new WsException({
        event: 'error',
        data: parsed.error,
      });
    }

    return parsed.data;
  }
}
