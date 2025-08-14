
import { Injectable, Type } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GenericValidationPipe, SchemaFactory } from '../pipes/generic-validation.pipe';

export function createValidationPipeWithModel<T>(
  modelName: string,
  schemaFactory: SchemaFactory<T>
): Type<GenericValidationPipe<T>> {
  @Injectable()
  class DynamicValidationPipe extends GenericValidationPipe<T> {
    constructor(@InjectModel(modelName) model: Model<any>) {
      super(schemaFactory, model);
    }
  }
  return DynamicValidationPipe;
}

