import { CONFIG } from './config';

export interface ActivityHooks {
  onWorking: () => void;
  onSuccess: () => void;
  onIdle: () => void;
}

type ActivityPhase = 'idle' | 'arming' | 'working' | 'success';

/**
 * Converts noisy process CPU samples into calm, meaningful visual states.
 * It intentionally uses hysteresis, debounce, minimum working duration,
 * inactivity settling and a success hold instead of forwarding raw samples.
 */
export class CodexActivityInterpreter {
  private phase: ActivityPhase = 'idle';
  private smoothedCpu = 0;
  private candidateSince = 0;
  private workingSince = 0;
  private lastActivityAt = 0;
  private successUntil = 0;
  private armingFrom: 'idle' | 'success' = 'idle';

  constructor(private readonly hooks: ActivityHooks) {}

  reset(emitIdle = false) {
    this.phase = 'idle';
    this.smoothedCpu = 0;
    this.candidateSince = 0;
    this.workingSince = 0;
    this.lastActivityAt = 0;
    this.successUntil = 0;
    this.armingFrom = 'idle';
    if (emitIdle) this.hooks.onIdle();
  }

  sample(cpu: number, now = performance.now()) {
    this.smoothedCpu += (cpu - this.smoothedCpu) * 0.32;
    const convincinglyActive = this.smoothedCpu >= CONFIG.CODEX_START_CPU;
    const stillActive = cpu >= CONFIG.CODEX_RELEASE_CPU || this.smoothedCpu >= CONFIG.CODEX_RELEASE_CPU;

    if (this.phase === 'idle') {
      if (convincinglyActive) {
        this.armingFrom = 'idle';
        this.phase = 'arming';
        this.candidateSince = now;
      }
      return;
    }

    if (this.phase === 'arming') {
      if (!stillActive) {
        if (this.armingFrom === 'success' && now < this.successUntil) {
          this.phase = 'success';
        } else {
          this.phase = 'idle';
          if (this.armingFrom === 'success') this.hooks.onIdle();
        }
        this.candidateSince = 0;
      } else if (now - this.candidateSince >= CONFIG.EVENT_DEBOUNCE_TIME) {
        this.phase = 'working';
        this.workingSince = now;
        this.lastActivityAt = now;
        this.hooks.onWorking();
      }
      return;
    }

    if (this.phase === 'working') {
      if (stillActive) this.lastActivityAt = now;
      const workedLongEnough = now - this.workingSince >= CONFIG.WORKING_MIN_TIME;
      const settled = now - this.lastActivityAt >= CONFIG.IDLE_DELAY;
      if (workedLongEnough && settled) {
        this.phase = 'success';
        this.successUntil = now + CONFIG.SUCCESS_HOLD_TIME;
        this.hooks.onSuccess();
      }
      return;
    }

    if (this.phase === 'success') {
      if (convincinglyActive) {
        this.armingFrom = 'success';
        this.phase = 'arming';
        this.candidateSince = now;
      } else if (now >= this.successUntil) {
        this.phase = 'idle';
        this.hooks.onIdle();
      }
    }
  }
}
