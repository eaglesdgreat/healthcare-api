import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter } from 'events'

export interface EventPayload {
  [key: string]: unknown
}

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name)
  private readonly emitter = new EventEmitter()
  private readonly brokerUrl = process.env.EVENT_BUS_URL

  constructor() {
    this.emitter.setMaxListeners(50)
  }

  emit(event: string, payload?: EventPayload): void {
    this.emitter.emit(event, payload)
    if (this.brokerUrl) {
      void this.publishToBroker(event, payload)
    }
  }

  emitAsync(event: string, payload?: EventPayload): Promise<void> {
    this.emitter.emit(event, payload)
    return this.publishToBroker(event, payload)
  }

  on(event: string, listener: (payload?: EventPayload) => void): void {
    this.emitter.on(event, listener)
  }

  once(event: string, listener: (payload?: EventPayload) => void): void {
    this.emitter.once(event, listener)
  }

  private async publishToBroker(
    event: string,
    payload?: EventPayload,
  ): Promise<void> {
    if (!this.brokerUrl) {
      return
    }

    try {
      await fetch(this.brokerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event,
          payload,
          timestamp: new Date().toISOString(),
        }),
      })
    } catch (error) {
      this.logger.warn(
        { err: error, event },
        'Failed to publish event to external broker',
      )
    }
  }
}
