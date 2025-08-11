import { Injectable } from '@nestjs/common';
import { SocketStore } from './socket.store';
import { Socket } from 'socket.io';

interface UserDetail {
  userId: string;
}
interface Participant {
  userDetail: UserDetail[];
}

@Injectable()
export class ChatService {
  constructor(private readonly socketStore: SocketStore) {}

  emitToFilteredSocket(
    participants: Participant[],
    userId: string,
    message: Record<string, any>,
  ) {
    const filteredParticipants = this.filterSelf(participants, userId);
    const sockets = this.getSockets(filteredParticipants);
    this.emitToUsers(sockets, message);
    return sockets.length;
  }

  emitToUsers(sockets: Socket[], sendMessage: Record<string, any>) {
    sockets.forEach((socket) => {
      if (socket) socket.emit('message', sendMessage);
    });
  }

  getSockets(participants: Participant[]): Socket[] {
    return participants
      .map((p) => this.socketStore.getFromUser(p.userDetail[0]?.userId))
      .filter((socket): socket is Socket => socket !== undefined);
  }

  filterSelf(participants: Participant[], userId: string) {
    return participants.filter(
      (participant) =>
        ![userId, undefined].includes(participant.userDetail[0].userId),
    );
  }
}
