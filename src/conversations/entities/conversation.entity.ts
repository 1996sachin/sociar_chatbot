import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ChatDocument = Conversation & Document;

@Schema()
export class Conversation {
  @Prop({ required: true })
  participants: any[];

  @Prop({ required: true })
  message: string;

  @Prop({ required: true })
  status: string;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

