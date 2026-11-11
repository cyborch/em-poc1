// jsdom has no layout: give Recharts' ResponsiveContainer a fixed size so charts render.
class ResizeObserverStub {
  private cb: ResizeObserverCallback
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb
  }
  observe(target: Element) {
    this.cb(
      [{ target, contentRect: { width: 800, height: 250 } } as unknown as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    )
  }
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
