export type TickCallback = () => void;

export class FixedStepLoop {
  private accumulatedMs = 0;
  private processedTicks = 0;
  private paused = false;

  constructor(
    private readonly tickDurationMs: number,
    private readonly maxTicksPerFrame = 5,
  ) {
    if (tickDurationMs <= 0 || maxTicksPerFrame <= 0) {
      throw new Error('FixedStepLoop durations and limits must be positive');
    }
  }

  get accumulatorMs(): number {
    return this.accumulatedMs;
  }

  get tickCount(): number {
    return this.processedTicks;
  }

  get backlogTicks(): number {
    return Math.floor(this.accumulatedMs / this.tickDurationMs);
  }

  get interpolationAlpha(): number {
    return Math.min(1, this.accumulatedMs / this.tickDurationMs);
  }

  get isPaused(): boolean {
    return this.paused;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  advance(frameDeltaMs: number, onTick?: TickCallback): number {
    if (this.paused) {
      return 0;
    }

    this.accumulatedMs += Math.max(0, frameDeltaMs);
    let ticksThisFrame = 0;
    while (
      this.accumulatedMs + Number.EPSILON >= this.tickDurationMs
      && ticksThisFrame < this.maxTicksPerFrame
    ) {
      onTick?.();
      this.accumulatedMs -= this.tickDurationMs;
      this.processedTicks += 1;
      ticksThisFrame += 1;
    }
    return ticksThisFrame;
  }
}
