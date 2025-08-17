import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  SEEN = 'seen',
}

export enum MessageTypes {
  LOG = 'log',
  TEXT = 'text',
  MEDIA = 'media',
}

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
  conversation: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: Types.ObjectId;

  @Prop({ required: true })
  content: string;

  @Prop({ required: true, enum: MessageStatus })
  messageStatus: MessageStatus;

  @Prop({})
  seenBy: string[];

  @Prop({ default: MessageTypes.TEXT })
  messageType: MessageTypes;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
