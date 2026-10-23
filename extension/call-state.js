// Shared by the content script and its regression tests; no browser storage needed.
globalThis.AtaMeetCallState = {
  leaveSelector: '[aria-label*="Sair da chamada" i], [aria-label*="Sair da reunião" i], [aria-label*="Sair da videochamada" i], [aria-label*="Leave call" i], [aria-label*="Leave meeting" i], [aria-label*="Leave video call" i], [data-tooltip*="Sair da chamada" i], [data-tooltip*="Leave call" i]',
  ended(text) {
    return /(?:você (?:saiu|deixou) (?:da |a )(?:chamada|reunião|videochamada)|a (?:chamada|reunião|videochamada) (?:foi encerrada|terminou|acabou)|você foi removido|you(?:'ve| have)? left (?:the |this )?(?:call|meeting)|the (?:call|meeting) has ended|you(?:'ve| have) been removed)/i.test(text);
  },
  shouldEnd({ ended, hasLeaveControl, lastSeen, now }) {
    return ended || (!hasLeaveControl && lastSeen > 0 && now - lastSeen >= 6000);
  },
};