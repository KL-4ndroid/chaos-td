import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { BattleScene } from './scenes/BattleScene';
import { deserializeReplay, type SimulationState } from '@chaos-td/game-core';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 480,
  height: 960,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, BattleScene],
};

const game = new Phaser.Game(config);

const fileInput = document.querySelector<HTMLInputElement>('#replay-file');
fileInput?.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  game.registry.set('trainingReplay', deserializeReplay(await file.text()));
  game.scene.stop('BattleScene');
  game.scene.start('BattleScene');
});
document.querySelector<HTMLButtonElement>('#replay-pause')?.addEventListener('click', () => game.events.emit('replay-toggle'));
document.querySelector<HTMLSelectElement>('#replay-speed')?.addEventListener('change', (event) => game.events.emit('replay-speed', Number((event.target as HTMLSelectElement).value)));

const monitor = document.querySelector<HTMLElement>('#training-status');
let liveEnabled = false;

function renderTrainingStatus(progress: Record<string, unknown> | null): void {
  if (!monitor) return;
  if (!progress) { monitor.textContent = 'Waiting for a training run…'; return; }
  const current = progress['currentMatch'] as Record<string, unknown> | null;
  const champion = progress['champion'] as Record<string, unknown> | null;
  monitor.innerHTML = [
    `<div class="training-row"><span>Status</span><span>${String(progress['status'] ?? 'unknown')}</span></div>`,
    `<div class="training-row"><span>Generation</span><span>${String(progress['generation'] ?? '—')}</span></div>`,
    `<div class="training-row"><span>Matches</span><span>${String(progress['completedMatches'] ?? 0)}</span></div>`,
    current ? `<div class="training-row"><span>Showcase</span><span>${String(current['stage'])} ${String(current['matchIndex'])}/${String(current['scheduledMatches'])}</span></div><div>${String(current['p1StrategyId'])} vs ${String(current['p2StrategyId'])}</div>` : '',
    champion ? `<div class="training-row"><span>Champion</span><span>${String(champion['strategyId'] ?? '—')} (${String(champion['elo'] ?? '—')})</span></div>` : '',
  ].join('');
}

async function pollTrainingLive(): Promise<void> {
  try {
    const response = await fetch('/api/training/live', { cache: 'no-store' });
    if (!response.ok) return;
    const payload = await response.json() as { progress: Record<string, unknown> | null; state: { state?: SimulationState } | null };
    renderTrainingStatus(payload.progress);
    if (liveEnabled && payload.state?.state) game.events.emit('training-live-state', payload.state.state);
  } catch {
    // The client remains playable when the local trainer or dev server is off.
  }
}

document.querySelector<HTMLButtonElement>('#training-live')?.addEventListener('click', () => {
  liveEnabled = !liveEnabled;
  const button = document.querySelector<HTMLButtonElement>('#training-live');
  if (button) button.textContent = liveEnabled ? 'Exit live view' : 'Live training';
  if (!liveEnabled) game.events.emit('training-live-stop');
  void pollTrainingLive();
});
void pollTrainingLive();
window.setInterval(() => void pollTrainingLive(), 1000);

export { game };
