import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { getByValue } from 'src/common/utils/map.utils';

interface UserDetail {
  userId: string;
}
interface Participant {
  userDetail: UserDetail[];
}

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

  has(socketId) {
    return this.store.has(socketId);
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

  emitToFilteredSocket(
    eventName: string,
    participants: Participant[],
    userId: string,
    message: Record<string, any>,
  ) {
    const filteredParticipants = this.filterSelf(participants, userId);
    return this.emitToSocket(eventName, filteredParticipants, message);
  }
  // remove pachi use this
  emitToSocket(
    eventName: string,
    participants: Participant[],
    message: Record<string, any>,
  ) {
    const sockets = this.getSockets(participants);
    this.emitToUsers(eventName, sockets, message);
    return sockets.length;
  }

  private emitToUsers(
    eventName: string,
    sockets: Socket[],
    sendMessage: Record<string, any>,
  ) {
    sockets.forEach((socket) => {
      if (socket) socket.emit(eventName, sendMessage);
    });
  }

  private getSockets(participants: Participant[]): Socket[] {
    return participants
      .map((p) => this.getFromUser(p.userDetail[0]?.userId))
      .filter((socket): socket is Socket => socket !== undefined);
  }

  private filterSelf(participants: Participant[], userId: string) {
    return participants.filter(
      (participant) =>
        ![userId, undefined].includes(participant.userDetail[0].userId),
    );
  }
}
