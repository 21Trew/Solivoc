export const RUNTIME_BASELINE_SCENARIOS = Object.freeze([
  { id: "actions-1000", title: "1000 игровых действий", target: 1000, metric: "actions" },
  { id: "restart-100", title: "100 перезапусков уровня", target: 100, metric: "restarts" },
  { id: "profile-100", title: "100 открытий/закрытий профиля", target: 100, metric: "profileCycles" },
  { id: "hub-game-100", title: "100 переходов hub ↔ game", target: 100, metric: "navigationCycles" },
  { id: "lifecycle-100", title: "100 background ↔ foreground", target: 100, metric: "lifecycleCycles" },
  { id: "drag-cancel-100", title: "100 drag + cancel", target: 100, metric: "dragCycles" },
  { id: "undo-100", title: "100 undo", target: 100, metric: "undos" },
  { id: "levels-50", title: "50 последовательных уровней", target: 50, metric: "levels" },
  { id: "force-close-move", title: "Force-close сразу после хода", target: 1, metric: "recovery" },
  { id: "force-close-win", title: "Force-close сразу после победы", target: 1, metric: "recovery" },
  { id: "offline-reconnect", title: "Offline → force-close → reopen → reconnect", target: 1, metric: "offlineRecovery" },
  { id: "network-flap", title: "Rapid offline/online flapping", target: 20, metric: "networkTransitions" },
  { id: "corrupt-round", title: "Повреждённый primary round snapshot", target: 1, metric: "recovery" },
  { id: "storage-failure", title: "Storage write/quota failure", target: 1, metric: "storageRecovery" },
  { id: "sw-active-round", title: "SW update во время активной партии", target: 1, metric: "updateSafety" },
  { id: "account-switch", title: "Account switch при pending request", target: 1, metric: "sessionIsolation" },
]);

export function baselineScenarioManifest() {
  return {
    version: "0.01",
    generatedAt: new Date().toISOString(),
    scenarios: RUNTIME_BASELINE_SCENARIOS.map((scenario) => ({ ...scenario })),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(`${JSON.stringify(baselineScenarioManifest(), null, 2)}\n`);
}
