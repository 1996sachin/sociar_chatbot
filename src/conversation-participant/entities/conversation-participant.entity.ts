import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConvPartDocument = ConvPart & Document;

@Schema()
export class ConvPart {
  @Prop({ type: [{ type: Types.ObjectId, ref: 'conversations' }] })
  conversation: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'users' }] })
  users: Types.ObjectId;
}

export const ConvPartSchema = SchemaFactory.createForClass(ConvPart);
