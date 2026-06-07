if (typeof chrome !== 'undefined' && chrome.devtools?.panels) {
  chrome.devtools.panels.create('API Timeline', '', 'panel.html');
}
