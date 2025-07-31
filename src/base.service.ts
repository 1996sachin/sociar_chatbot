import { NotFoundException } from '@nestjs/common';
import { Model, Document } from 'mongoose';

export class BaseService<T extends Document> {
  private entity: Model<T>;

  constructor(entity: Model<T>) {
    this.entity = entity;
  }

  async save(data: any) {
    const created = new this.entity({
      ...data,
    });
    return await created.save();
  }

  async all() {
    return await this.entity.find();
  }

  async find(id: string) {
    const result = await this.entity.findById(id);
    if (!result) {
      throw new NotFoundException('No such resource found');
    }
    return result;
  }

  async update(id: string, data: any) {
    const updated = await this.entity.findByIdAndUpdate(id, { $set: data });
    if (!updated) {
      throw new NotFoundException('No such resource found');
    }
  }

  async delete(id: string) {
    const deleted = await this.entity.findByIdAndDelete(id);
    if (!deleted) {
      throw new NotFoundException('No sych resource found');
    }
  }
}
