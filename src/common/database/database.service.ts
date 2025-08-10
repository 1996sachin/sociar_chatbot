import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import * as mongoose from 'mongoose';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private tenentDbs: Map<string, mongoose.Connection> = new Map();
  private isConnected = false;

  async getTenentDb(tenentId: string): Promise<mongoose.Connection> {
    if (!this.isConnected) {
      const uri = process.env.DATABASE_URL;

      if (!uri) throw new NotFoundException('DATABASE_URL not found');
      await mongoose.connect(uri, { maxPoolSize: 10 });
      this.isConnected = true;
    }

    if (this.tenentDbs.has(tenentId)) {
      console.log(this.tenentDbs.get(tenentId));
      return this.tenentDbs.get(tenentId)!;
    }

    const tenentDb = mongoose.connection.useDb(`tenent_${tenentId}`, {
      useCache: true,
    });
    return tenentDb;
  }

  async onModuleDestroy() {
    await mongoose.disconnect();
  }
}
