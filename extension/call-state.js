// Shared by the content script and its regression tests; no browser storage needed.
globalThis.AtaMeetCallState = {
  leaveSelector: '[aria-label*="Sair da chamada" i], [aria-label*="Sair da reunião" i], [aria-label*="Sair da videochamada" i], [aria-label*="Leave call" i], [aria-label*="Leave meeting" i], [aria-label*="Leave video call" i], [data-tooltip*="Sair da chamada" i], [data-tooltip*="Leave call" i]',
  ended(text) {
    return /(?:você saiu da (?:chamada|reunião)|a (?:chamada|reunião) (?:foi encerrada|terminou)|você foi removido|you left the (?:call|meeting)|the (?:call|meeting) has ended|you(?:'ve| have) been removed)/i.test(text);
  },
  shouldEnd({ ended, hasLeaveControl, lastSeen, now }) {
    return ended || (!hasLeaveControl && lastSeen > 0 && now - lastSeen >= 6000);
  },
};