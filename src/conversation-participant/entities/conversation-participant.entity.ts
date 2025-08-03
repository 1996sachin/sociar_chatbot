import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConversationParticipantDocument = ConversationParticipant &
  Document;

@Schema()
export class ConversationParticipant {
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Conversation' }] })
  conversation: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }] })
  users: Types.ObjectId;
}

export const ConversationParticipantSchema = SchemaFactory.createForClass(
  ConversationParticipant,
);
