import { ArgumentMetadata, Injectable, PipeTransform } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { WsException } from "@nestjs/websockets";
import { Model } from "mongoose";
import { removeParticipantDto, removeParticipantSchema } from "src/chat/chat.validator";
import { ChatDocument, Conversation } from "src/conversations/entities/conversation.entity";

@Injectable()
export class RemoveParticipantValidationPipe implements PipeTransform {
  constructor(
    @InjectModel(Conversation.name) private readonly ConversationModel: Model<ChatDocument>,
  ) { }

  async transform(value: any): Promise<removeParticipantDto> {
    const schema = removeParticipantSchema(this.ConversationModel)
    const parsed = await schema.safeParseAsync(value)
    if (!parsed.success) {
      throw new WsException({
        event: "error",
        data: parsed.error
      })
    }

    return parsed.data

  }
}
