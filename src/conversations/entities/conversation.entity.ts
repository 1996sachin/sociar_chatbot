import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChatDocument = Conversation & Document;

export enum conversationType {
  GROUP = "group",
  PRIVATE = "private"
}

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

  @Prop()
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  createdBy: Types.ObjectId;

  @Prop({ default: conversationType.PRIVATE })
  conversationType: conversationType

}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
