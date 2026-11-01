import { EventBusService } from './event-bus.service'

describe('EventBusService', () => {
  it('dispatches events only to in-process listeners', async () => {
    const eventBus = new EventBusService()
    const listener = jest.fn()
    eventBus.on('auth.activity', listener)

    await eventBus.emitAsync('auth.activity', { action: 'login' })

    expect(listener).toHaveBeenCalledWith({ action: 'login' })
  })
})
