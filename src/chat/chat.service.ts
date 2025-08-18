import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';
import { SocketStore } from 'src/common/socket/socket.store';

interface UserDetail {
  userId: string;
}
interface Participant {
  userDetail: UserDetail[];
}

@Injectable()
export class ChatService {
  constructor(private readonly socketStore: SocketStore) { }

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
      .map((p) => this.socketStore.getFromUser(p.userDetail[0]?.userId))
      .filter((socket): socket is Socket => socket !== undefined);
  }

  private filterSelf(participants: Participant[], userId: string) {
    return participants.filter(
      (participant) =>
        ![userId, undefined].includes(participant.userDetail[0].userId),
    );
  }
}
