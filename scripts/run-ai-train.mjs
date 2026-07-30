import { createSmokePopulation, AI_TRAINING_SMOKE_CONFIG, runSelfPlayMatch } from '@chaos-td/ai-training';

const population = createSmokePopulation(AI_TRAINING_SMOKE_CONFIG.populationSize);
const seeds = AI_TRAINING_SMOKE_CONFIG.seedRegistry;

const results = [];
for (const p1 of population) {
  for (const p2 of population) {
    for (const seed of seeds) {
      results.push(runSelfPlayMatch(seed, p1, p2, 300));
    }
  }
}

let wins = 0, draws = 0, tickGuard = 0;
for (const r of results) {
  if (r.outcome === 'win') wins++;
  else if (r.outcome === 'draw') draws++;
  if (r.completion === 'tick_guard') tickGuard++;
}

console.log(JSON.stringify({
  totalMatches: results.length,
  wins, draws, tickGuard,
  avgAcceptedCommands: results.reduce((s, r) => s + r.acceptedCommands, 0) / results.length,
}));
