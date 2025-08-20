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

  async saveMany(data: any[]) {
    return await this.entity.insertMany(data);
  }

  async saveIfNotExists(data: any) {
    const options = { upsert: true, new: true, setDefaultsOnInsert: true };
    return await this.entity.findOneAndUpdate(data, data, options);
  }

  async all() {
    return await this.entity.find();
  }

  async find(id: any) {
    const result = await this.entity.findById(id);
    return result;
  }

  async findWhere(where: any) {
    const result = await this.entity.find(where);
    return result;
  }

  async findAll(where: any) {
    const result = await this.entity.find(where);
    return result;
  }

  async update(id: any, data: any) {
    const updated = await this.entity.findByIdAndUpdate(
      id,
      {
        $addToSet: data,
      },
      { new: true },
    );
    return updated;
  }

  async updateMany(id: any, data: []) {
    const updated = await this.entity.findByIdAndUpdate(
      id,
      {
        $set: data,
      },
      { new: true },
    );
    return updated;
  }

  async updateWhere(filter: any, data: any) {
    const updatedData = await this.entity.updateMany(filter, {
      $set: data,
    });
    return updatedData;
  }

  async delete(id: any) {
    const deleted = await this.entity.findByIdAndDelete(id);
    return deleted;
  }

  getRepository() {
    return this.entity;
  }
}
