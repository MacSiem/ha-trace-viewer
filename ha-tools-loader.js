/**
 * HA Tools Panel — Dynamic Loader
 * Ten plik jest wskazany w configuration.yaml i NIGDY nie wymaga zmiany ?v=N.
 * Ładuje dynamicznie ha-tools-panel.js z cache-bustem (timestamp),
 * więc przeglądarka zawsze pobiera najnowszą wersję panelu.
 *
 * configuration.yaml:
 *   panel_custom:
 *     - name: ha-tools-panel
 *       sidebar_title: HA Tools
 *       sidebar_icon: mdi:toolbox
 *       url_path: ha-tools
 *       js_url: /local/community/ha-trace-viewer/ha-tools-loader.js
 */
(function() {
  const BASE = '/local/community/ha-trace-viewer/ha-tools-panel.js';
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = BASE + '?_=' + Date.now();
  script.onerror = () => console.error('[HA Tools Loader] Failed to load panel:', BASE);
  document.head.appendChild(script);
  console.log('[HA Tools Loader] Loading panel with cache-bust:', script.src);
})();
