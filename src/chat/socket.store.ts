import { Injectable, Scope } from '@nestjs/common';
import { getByValue } from '../utils/map.utils';

@Injectable({ scope: Scope.DEFAULT })
export class SocketStore {
  private store: Map<string, any> = new Map();
  private userSocketStore: Map<string, string> = new Map();

  add(userId, socketId, socket) {
    this.userSocketStore.set(userId, socketId);
    this.store.set(socketId, socket);
  }

  getFromUser(userId) {
    return this.get(this.userSocketStore.get(userId));
  }

  get(socketId) {
    return this.store.get(socketId);
  }

  has(socketId) {
    return this.store.has(socketId);
  }

  // For Test
  getAll() {
    return Array.from(this.store.keys());
  }

  getUserFromSocket(socketId: string) {
    return getByValue(this.userSocketStore, socketId);
  }

  remove(socketId) {
    this.userSocketStore.delete(getByValue(this.userSocketStore, socketId));
    this.store.delete(socketId);
  }
}
