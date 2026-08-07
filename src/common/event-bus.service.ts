import { Injectable } from '@nestjs/common'
import { EventEmitter } from 'events'

export interface EventPayload {
  [key: string]: unknown
}

@Injectable()
export class EventBusService {
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
      console.warn('Failed to publish event to broker:', error)
    }
  }
}
