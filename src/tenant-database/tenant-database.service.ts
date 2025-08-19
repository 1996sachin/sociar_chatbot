import { Injectable } from '@nestjs/common';
import { ContextIdFactory, ModuleRef } from '@nestjs/core';
import { SocketService } from 'src/common/socket/socket.service';
import { SocketStore } from 'src/common/socket/socket.store';
import { ConversationParticipantService } from 'src/conversation-participant/conversation-participant.service';
import { ConversationsService } from 'src/conversations/conversations.service';
import { MessageService } from 'src/messages/messages.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class TenantServiceFactory {
  private serviceCache = new Map<string, any>();
  constructor(private readonly moduleRef: ModuleRef) {}

  async getServicesForTenant(tenantId: string) {
    if (this.serviceCache.has(tenantId)) return this.serviceCache.get(tenantId);

    const contextId = ContextIdFactory.create();
    this.moduleRef.registerRequestByContextId({ tenantId }, contextId);
    const definedServices = [
      UsersService,
      MessageService,
      ConversationsService,
      ConversationParticipantService,
      SocketStore,
    ];

    const instances = await Promise.all(
      definedServices.map((service) =>
        this.moduleRef.resolve(service, contextId, { strict: false }),
      ),
    );
    const services = definedServices.reduce(
      (acc, service, index) => {
        acc[service.name] = instances[index];
        return acc;
      },
      {} as Map<string, any>,
    );

    const tenantSocketStore = new SocketStore();
    services[SocketService.name] = new SocketService(tenantSocketStore);
    services[SocketStore.name] = tenantSocketStore;

    this.serviceCache.set(tenantId, services);
    return services;
  }
}
