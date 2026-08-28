export type CoreState = 'idle' | 'working' | 'success' | 'error' | 'critical' | 'critical2' | 'attention';
export type VisualState = 'calm' | 'work' | 'error' | 'critical' | 'critical2';

export function getVisualState(state: CoreState): VisualState {
  if (state === 'error') return 'error';
  if (state === 'critical') return 'critical';
  if (state === 'critical2') return 'critical2';
  if (state === 'working') return 'work';
  return 'calm';
}

export type CoreEvent =
  | { type: 'IDLE'; source?: string }
  | { type: 'WORKING_STARTED'; source?: string }
  | { type: 'WORKING_PROGRESS'; files?: number; commands?: number }
  | { type: 'WORKING_COMPLETED' }
  | { type: 'ERROR_RAISED' }
  | { type: 'CRITICAL_ERROR_RAISED' }
  | { type: 'CRITICAL2_ERROR_RAISED' }
  | { type: 'ERROR_RESOLVED' }
  | { type: 'ATTENTION_REQUIRED' }
  | { type: 'HOVER_ENTER' }
  | { type: 'HOVER_LEAVE' };

export interface Snapshot {
  state: CoreState;
  hovered: boolean;
  source: string;
  files: number;
  commands: number;
  errors: number;
}

type Listener = (snapshot: Readonly<Snapshot>, event: CoreEvent) => void;

export class CoreStore {
  private data: Snapshot = { state: 'idle', hovered: false, source: 'local-sim', files: 0, commands: 0, errors: 0 };
  private listeners = new Set<Listener>();
  get snapshot(): Readonly<Snapshot> { return this.data; }
  subscribe(fn: Listener) { this.listeners.add(fn); fn(this.data, { type: 'IDLE' }); return () => this.listeners.delete(fn); }

  dispatch(event: CoreEvent) {
    const next = { ...this.data };
    switch (event.type) {
      case 'IDLE': next.state = 'idle'; next.source = event.source ?? next.source; break;
      case 'WORKING_STARTED': next.state = 'working'; next.source = event.source ?? next.source; break;
      case 'WORKING_PROGRESS': next.files = event.files ?? next.files; next.commands = event.commands ?? next.commands; break;
      case 'WORKING_COMPLETED': next.state = 'success'; break;
      case 'ERROR_RAISED': next.state = 'error'; next.errors++; break;
      case 'CRITICAL_ERROR_RAISED': next.state = 'critical'; next.errors++; break;
      case 'CRITICAL2_ERROR_RAISED': next.state = 'critical2'; next.errors++; break;
      case 'ERROR_RESOLVED': next.state = 'idle'; break;
      case 'ATTENTION_REQUIRED': next.state = 'attention'; break;
      case 'HOVER_ENTER': next.hovered = true; break;
      case 'HOVER_LEAVE': next.hovered = false; break;
    }
    this.data = next;
    this.listeners.forEach(fn => fn(next, event));
  }
}
