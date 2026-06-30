if (typeof chrome !== 'undefined' && chrome.devtools?.panels) {
  chrome.devtools.panels.create('DevLens', '', 'panel.html');
}
