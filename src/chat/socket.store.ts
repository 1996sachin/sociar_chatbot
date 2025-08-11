import { Injectable } from '@nestjs/common';
import { getByValue } from 'src/common/utils/map.utils';
import { Socket } from 'socket.io';

@Injectable()
export class SocketStore {
  private store: Map<string, Socket> = new Map();
  private userSocketStore: Map<string, string> = new Map();

  add(userId: string, socketId: string, socket: Socket) {
    this.userSocketStore.set(userId, socketId);
    this.store.set(socketId, socket);
  }

  getFromUser(userId: string) {
    const getSocket = this.userSocketStore.get(userId);
    if (getSocket) return this.get(getSocket);
    return;
  }

  get(socketId: string): Socket | undefined {
    const socket: Socket | undefined = this.store.get(socketId);
    if (socket instanceof Socket) return socket;
    return;
  }

  // For Test
  getAll() {
    return Array.from(this.store.keys());
  }

  getUserFromSocket(socketId: string) {
    return getByValue(this.userSocketStore, socketId);
  }

  remove(socketId: string) {
    const socket = getByValue(this.userSocketStore, socketId);
    if (socket) this.userSocketStore.delete(socket);
    this.store.delete(socketId);
  }
}
