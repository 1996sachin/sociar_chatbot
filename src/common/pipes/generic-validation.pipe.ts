import { Injectable, PipeTransform, Type, Inject } from '@nestjs/common';
import { Model } from 'mongoose';
import { WsException } from '@nestjs/websockets';
import { ZodSchema } from 'zod';

export type SchemaFactory<T> = (model?: Model<any>) => ZodSchema<T>;

@Injectable()
export class GenericValidationPipe<T> implements PipeTransform {
  constructor(
    private readonly schemaFactory: SchemaFactory<T>,
    private readonly model?: Model<any>
  ) { }

  async transform(value: any) {
    const schema = this.schemaFactory(this.model);
    const parsed = await schema.safeParseAsync(value);

    if (!parsed.success) {
      throw new WsException({
        event: 'error',
        data: parsed.error.format(),
      });
    }

    return parsed.data;
  }
}
