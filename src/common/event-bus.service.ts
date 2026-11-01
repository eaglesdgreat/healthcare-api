import { Injectable } from '@nestjs/common'
import { EventEmitter } from 'events'

export interface EventPayload {
  [key: string]: unknown
}

@Injectable()
export class EventBusService {
  private readonly emitter = new EventEmitter()

  constructor() {
    this.emitter.setMaxListeners(50)
  }

  emit(event: string, payload?: EventPayload): void {
    this.emitter.emit(event, payload)
  }

  emitAsync(event: string, payload?: EventPayload): Promise<void> {
    this.emitter.emit(event, payload)
    return Promise.resolve()
  }

  on(event: string, listener: (payload?: EventPayload) => void): void {
    this.emitter.on(event, listener)
  }

  once(event: string, listener: (payload?: EventPayload) => void): void {
    this.emitter.once(event, listener)
  }
}
