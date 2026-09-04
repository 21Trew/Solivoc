/* Browser controller around the pure game engine. Owns only state assignment. */
(() => {
  "use strict";

  const root = typeof window !== "undefined" ? window : globalThis;
  if (root.SolivocGameController) return;

  function dispatch(command, currentState = typeof state !== "undefined" ? state : null) {
    const engine = root.SolivocGameEngine;
    if (!engine?.reduce) return { accepted: false, state: currentState, effects: [], reason: "engine_unavailable", command };
    const result = engine.reduce(currentState, command);
    if (result.accepted && typeof state !== "undefined") state = result.state;
    return result;
  }

  function effect(result, type) {
    return result?.effects?.find?.((item) => item?.type === type) || null;
  }

  root.SolivocGameController = Object.freeze({ dispatch, effect });
})();
