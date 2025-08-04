import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChatDocument = Conversation & Document;

@Schema({ timestamps: true })
export class Conversation {
  @Prop({
    type: [
      { type: Types.ObjectId, ref: 'ConversationParticipant', required: true },
    ],
  })
  participants: [Types.ObjectId];

  @Prop()
  lastMessage: string;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
