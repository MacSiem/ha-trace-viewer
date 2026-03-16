class HADeviceHealth extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._activeTab = "devices";
    this._deviceFilter = "all";
    this._domainFilter = "all";
    this._searchQuery = "";
    this._groupByDomain = false;
    this._sortBy = "name";
    this._sortDirection = "asc";
    this._batterySortBy = "level";
    this._alerts = [];
    this._alertHistory = [];
    this._acknowledgedAlerts = new Set();
    this._lastUpdate = Date.now();
    this._currentPage = 1;
    this._pageSize = 15;
    this._alertCurrentPage = 1;
    this._alertPageSize = 15;
    this._alertSortBy = "timestamp";
    this._alertSortDirection = "desc";
    this._alertFilterType = "all";
    this._alertFilterSeverity = "all";
    this._alertSearchQuery = "";
    this._alertHistoryPage = 1;
  }

  static get _translations() {
    return {
      en: {
        deviceHealth: "Device Health",
        devices: "Devices",
        batteries: "Batteries",
        network: "Network",
        alerts: "Alerts",
        searchDevices: "Search devices...",
        all: "All",
        online: "Online",
        offline: "Offline",
        unavailable: "Unavailable",
        toggleGrouping: "Toggle Grouping",
        totalDevices: "Total Devices",
        availability: "Availability",
        name: "Name",
        type: "Type",
        status: "Status",
        lastSeen: "Last Seen",
        uptime: "Uptime",
        levelWorstFirst: "Level (Worst First)",
        batteryHealthSummary: "Battery Health Summary",
        deviceNeedAttention: "device(s) need attention",
        lastChanged: "Last changed",
        networkDevices: "Devices",
        signalStrengthDist: "Signal Strength Distribution",
        activeAlerts: "Active Alerts",
        noActiveAlerts: "No active alerts",
        alertHistory: "Alert History",
        dismiss: "Dismiss",
        page: "Page",
        of: "of",
        itemsPerPage: "Items per page",
        previous: "Previous",
        next: "Next",
        filterByType: "Filter by type",
        allTypes: "All Types",
        grouped: "Grouped",
        flat: "Flat",
        sortAsc: "^",
        sortDesc: "ˇ",
        severity: "Severity",
        time: "Time",
        alertType: "Type",
        device: "Device",
        searchAlerts: "Search alerts...",
        allSeverities: "All Severities",
        allAlertTypes: "All Alert Types",
        critical: "Critical",
        warning: "Warning",
        info: "Info",
        showing: "Showing",
        total: "total",
      },
      pl: {
        deviceHealth: "Zdrowie Urządzeń",
        devices: "Urządzenia",
        batteries: "Baterie",
        network: "Sieć",
        alerts: "Alerty",
        searchDevices: "Szukaj urządzeń...",
        all: "Wszystkie",
        online: "Online",
        offline: "Offline",
        unavailable: "Niedostępne",
        toggleGrouping: "Przełącz Grupowanie",
        totalDevices: "Razem Urządzeń",
        availability: "Dostępność",
        name: "Nazwa",
        type: "Typ",
        status: "Status",
        lastSeen: "Ostatnio Widziane",
        uptime: "Czas Pracy",
        levelWorstFirst: "Poziom (Najgorsze Pierwsze)",
        batteryHealthSummary: "Podsumowanie Zdrowia Baterii",
        deviceNeedAttention: "urządzenie(ń) wymaga uwagi",
        lastChanged: "Ostatnio zmienione",
        networkDevices: "Urządzenia",
        signalStrengthDist: "Rozkład Siły Sygnału (dBm)",
        activeAlerts: "Aktywne Alerty",
        noActiveAlerts: "Brak aktywnych alertów",
        alertHistory: "Historia Alertów",
        dismiss: "Odrzuć",
        page: "Strona",
        of: "z",
        itemsPerPage: "Elementów na stronie",
        previous: "Poprzednia",
        next: "Następna",
        filterByType: "Filtruj po typie",
        allTypes: "Wszystkie Typy",
        grouped: "Grupowane",
        flat: "Płaskie",
        sortAsc: "^",
        sortDesc: "ˇ",
        severity: "Ważność",
        time: "Czas",
        alertType: "Typ",
        device: "Urządzenie",
        searchAlerts: "Szukaj alertów...",
        allSeverities: "Wszystkie Ważności",
        allAlertTypes: "Wszystkie Typy Alertów",
        critical: "Krytyczny",
        warning: "Ostrzeżenie",
        info: "Informacja",
        showing: "Wyświetlanie",
        total: "łącznie",
      },
    };
  }

  _t(key) {
    const lang = this._hass?.language || 'en';
    const T = HADeviceHealth._translations;
    return (T[lang] || T['en'])[key] || T['en'][key] || key;
  }

  setConfig(config) {
    this._config = {
      title: "Device Health",
      battery_warning: 30,
      battery_critical: 10,
      offline_alert_minutes: 60,
      ...config,
    };
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  _update() {
    this._generateAlerts();
    this._render();
  }

  _getDevices() {
    const devices = [];

    if (!this._hass || !this._hass.states) {
      return this._getDemoDevices();
    }

    const states = this._hass.states;
    const seenEntities = new Set();

    // Collect device_tracker entities
    Object.keys(states).forEach((entityId) => {
      if (entityId.startsWith("device_tracker.")) {
        const state = states[entityId];
        seenEntities.add(entityId);
        devices.push({
          id: entityId,
          name: state.attributes.friendly_name || this._formatEntityName(entityId),
          type: "device_tracker",
          status: state.state === "home" ? "online" : state.state === "not_home" ? "offline" : "unavailable",
          lastSeen: state.attributes.last_seen || state.last_changed,
          uptime: this._calculateUptime(state.last_changed),
          domain: "device_tracker",
        });
      }
    });

    // Collect switch/light/sensor/climate/binary_sensor/media_player/fan/cover/vacuum/camera devices
    Object.keys(states).forEach((entityId) => {
      if (seenEntities.has(entityId)) return;
      const domain = entityId.split(".")[0];
      if (["switch", "light", "climate", "sensor", "binary_sensor", "media_player", "fan", "cover", "vacuum", "camera", "lock", "automation", "input_boolean"].includes(domain) && !entityId.includes("_battery") && !entityId.includes("_signal")) {
        const state = states[entityId];
        seenEntities.add(entityId);
        const isAvailable = state.state !== "unavailable" && state.state !== "unknown";
        devices.push({
          id: entityId,
          name: state.attributes.friendly_name || this._formatEntityName(entityId),
          type: domain,
          status: !isAvailable ? "unavailable" : state.state === "off" || state.state === "unknown" ? "offline" : "online",
          lastSeen: state.last_changed,
          uptime: this._calculateUptime(state.last_changed),
          domain: domain,
        });
      }
    });

    return devices.length > 0 ? devices : this._getDemoDevices();
  }

  _getBatteryDevices() {
    const batteries = [];

    if (!this._hass || !this._hass.states) {
      return this._getDemoBatteries();
    }

    const states = this._hass.states;

    Object.keys(states).forEach((entityId) => {
      if (entityId.includes("_battery") || entityId.includes("battery_level")) {
        const state = states[entityId];
        const level = parseInt(state.state);

        if (!isNaN(level)) {
          batteries.push({
            id: entityId,
            name: state.attributes.friendly_name || this._formatEntityName(entityId),
            level: level,
            lastChanged: state.last_changed,
            device: state.attributes.device_name || this._extractDeviceName(entityId),
          });
        }
      }
    });

    return batteries.length > 0 ? batteries : this._getDemoBatteries();
  }

  _getNetworkDevices() {
    const networks = {};

    if (!this._hass || !this._hass.states) {
      return this._getDemoNetworks();
    }

    const states = this._hass.states;
    const seenDevices = new Set();

    // 1. Signal/RSSI entities (original detection)
    Object.keys(states).forEach((entityId) => {
      if (entityId.includes("_signal") || entityId.includes("signal_strength") || entityId.includes("rssi") || entityId.includes("_lqi")) {
        const state = states[entityId];
        const rssi = parseInt(state.state);

        if (!isNaN(rssi)) {
          const protocol = this._detectProtocol(entityId);
          if (!networks[protocol]) {
            networks[protocol] = [];
          }
          const deviceName = state.attributes.friendly_name || this._formatEntityName(entityId);
          const deviceKey = this._extractDeviceName(entityId);
          if (!seenDevices.has(deviceKey)) {
            seenDevices.add(deviceKey);
            networks[protocol].push({
              id: entityId,
              name: deviceName,
              rssi: rssi,
              device: state.attributes.device_name || deviceKey,
            });
          }
        }
      }
    });

    // 2. device_tracker entities that are "home" (connected to network)
    Object.keys(states).forEach((entityId) => {
      if (entityId.startsWith("device_tracker.")) {
        const state = states[entityId];
        const attrs = state.attributes;
        const deviceName = attrs.friendly_name || this._formatEntityName(entityId);
        const deviceKey = entityId;

        if (seenDevices.has(deviceKey)) return;

        // Include if it has network-related attributes
        const hasNetworkAttrs = attrs.ip || attrs.ip_address || attrs.mac || attrs.mac_address ||
                                attrs.hostname || attrs.source_type === "router" || attrs.source_type === "ping";

        if (hasNetworkAttrs || state.state === "home") {
          seenDevices.add(deviceKey);
          const protocol = attrs.source_type === "bluetooth" || attrs.source_type === "bluetooth_le" ? "Bluetooth" :
                           attrs.source_type === "router" || attrs.source_type === "ping" ? "WiFi/LAN" : "WiFi/LAN";
          if (!networks[protocol]) {
            networks[protocol] = [];
          }
          // Use a synthetic RSSI or try to extract from attrs
          const rssi = attrs.rssi || attrs.signal_strength || (state.state === "home" ? -50 : -90);
          networks[protocol].push({
            id: entityId,
            name: deviceName,
            rssi: typeof rssi === 'number' ? rssi : parseInt(rssi) || -50,
            device: deviceName,
            ip: attrs.ip || attrs.ip_address || '',
            mac: attrs.mac || attrs.mac_address || '',
          });
        }
      }
    });

    // 3. binary_sensor with device_class "connectivity"
    Object.keys(states).forEach((entityId) => {
      if (entityId.startsWith("binary_sensor.")) {
        const state = states[entityId];
        const attrs = state.attributes;

        if (attrs.device_class === "connectivity" || entityId.includes("_connectivity") || entityId.includes("_connected")) {
          const deviceKey = entityId;
          if (seenDevices.has(deviceKey)) return;
          seenDevices.add(deviceKey);

          const protocol = "WiFi/LAN";
          if (!networks[protocol]) {
            networks[protocol] = [];
          }
          networks[protocol].push({
            id: entityId,
            name: attrs.friendly_name || this._formatEntityName(entityId),
            rssi: state.state === "on" ? -45 : -95,
            device: attrs.friendly_name || this._extractDeviceName(entityId),
          });
        }
      }
    });

    // 4. ping sensors
    Object.keys(states).forEach((entityId) => {
      if (entityId.startsWith("binary_sensor.") && (entityId.includes("ping") || entityId.includes("_reachable"))) {
        const state = states[entityId];
        const attrs = state.attributes;
        const deviceKey = entityId;
        if (seenDevices.has(deviceKey)) return;
        seenDevices.add(deviceKey);

        const protocol = "WiFi/LAN";
        if (!networks[protocol]) {
          networks[protocol] = [];
        }
        networks[protocol].push({
          id: entityId,
          name: attrs.friendly_name || this._formatEntityName(entityId),
          rssi: state.state === "on" ? -40 : -95,
          device: attrs.friendly_name || this._extractDeviceName(entityId),
        });
      }
    });

    return Object.keys(networks).length > 0 ? networks : this._getDemoNetworks();
  }

  _getDemoDevices() {
    return [
      { id: "device_tracker.phone", name: "Mobile Phone", type: "device_tracker", status: "online", lastSeen: new Date(Date.now() - 300000).toISOString(), uptime: "5 days", domain: "device_tracker" },
      { id: "light.living_room", name: "Living Room Light", type: "light", status: "online", lastSeen: new Date(Date.now() - 60000).toISOString(), uptime: "30 days", domain: "light" },
      { id: "switch.kitchen", name: "Kitchen Switch", type: "switch", status: "online", lastSeen: new Date(Date.now() - 120000).toISOString(), uptime: "30 days", domain: "switch" },
      { id: "climate.bedroom", name: "Bedroom Thermostat", type: "climate", status: "offline", lastSeen: new Date(Date.now() - 3600000).toISOString(), uptime: "15 days", domain: "climate" },
      { id: "sensor.garage", name: "Garage Sensor", type: "sensor", status: "unavailable", lastSeen: new Date(Date.now() - 86400000).toISOString(), uptime: "2 days", domain: "sensor" },
    ];
  }

  _getDemoBatteries() {
    return [
      { id: "sensor.phone_battery", name: "Mobile Phone Battery", level: 78, lastChanged: new Date(Date.now() - 300000).toISOString(), device: "Mobile Phone" },
      { id: "sensor.watch_battery", name: "Smart Watch Battery", level: 45, lastChanged: new Date(Date.now() - 7200000).toISOString(), device: "Smart Watch" },
      { id: "sensor.remote_battery", name: "Remote Control Battery", level: 22, lastChanged: new Date(Date.now() - 86400000).toISOString(), device: "Remote Control" },
      { id: "sensor.sensor1_battery", name: "Hallway Sensor Battery", level: 8, lastChanged: new Date(Date.now() - 172800000).toISOString(), device: "Hallway Sensor" },
      { id: "sensor.keypad_battery", name: "Door Keypad Battery", level: 35, lastChanged: new Date(Date.now() - 3600000).toISOString(), device: "Door Keypad" },
    ];
  }

  _getDemoNetworks() {
    return {
      "WiFi": [
        { id: "sensor.phone_signal", name: "Mobile Phone", rssi: -45, device: "Mobile Phone" },
        { id: "sensor.laptop_signal", name: "Laptop", rssi: -62, device: "Laptop" },
        { id: "sensor.tv_signal", name: "Smart TV", rssi: -75, device: "Smart TV" },
      ],
      "Zigbee": [
        { id: "sensor.light1_signal", name: "Bulb 1", rssi: -68, device: "Bulb 1" },
        { id: "sensor.light2_signal", name: "Bulb 2", rssi: -72, device: "Bulb 2" },
      ],
      "Z-Wave": [
        { id: "sensor.lock_signal", name: "Door Lock", rssi: -58, device: "Door Lock" },
      ],
    };
  }

  _generateAlerts() {
    this._alerts = [];
    const now = Date.now();
    const offlineThreshold = this._config.offline_alert_minutes * 60 * 1000;
    const batteryWarning = this._config.battery_warning;
    const batteryCritical = this._config.battery_critical;

    // Device offline alerts
    this._getDevices().forEach((device) => {
      if (device.status === "offline" && (now - new Date(device.lastSeen).getTime()) > offlineThreshold) {
        this._addAlert("offline", device.name, device.id, "critical");
      } else if (device.status === "unavailable") {
        this._addAlert("unavailable", device.name, device.id, "warning");
      }
    });

    // Battery alerts
    this._getBatteryDevices().forEach((battery) => {
      if (battery.level <= batteryCritical) {
        this._addAlert("battery_critical", battery.name, battery.id, "critical");
      } else if (battery.level <= batteryWarning) {
        this._addAlert("battery_warning", battery.name, battery.id, "warning");
      }
    });

    // Signal strength alerts
    const networks = this._getNetworkDevices();
    Object.keys(networks).forEach((protocol) => {
      networks[protocol].forEach((device) => {
        if (device.rssi < -85) {
          this._addAlert("signal_weak", device.name, device.id, "warning");
        }
      });
    });
  }

  _addAlert(type, name, id, severity) {
    const alertId = `${type}_${id}`;
    if (!this._acknowledgedAlerts.has(alertId)) {
      this._alerts.push({ type, name, id, severity, timestamp: new Date().toISOString() });
      this._alertHistory.unshift({ type, name, id, severity, timestamp: new Date().toISOString() });
      if (this._alertHistory.length > 200) this._alertHistory.pop();
    }
  }

  _calculateUptime(lastChanged) {
    const diff = Date.now() - new Date(lastChanged).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days} days`;
    if (hours > 0) return `${hours} hours`;
    return `${Math.floor(diff / (1000 * 60))} minutes`;
  }

  _formatEntityName(entityId) {
    return entityId.split(".")[1].split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  }

  _extractDeviceName(entityId) {
    const parts = entityId.split(".")[1].replace(/_battery|_signal|_battery_level|_rssi/g, "").split("_");
    return parts.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  }

  _detectProtocol(entityId) {
    if (entityId.includes("zigbee") || entityId.includes("zha")) return "Zigbee";
    if (entityId.includes("zwave") || entityId.includes("z_wave")) return "Z-Wave";
    if (entityId.includes("bluetooth") || entityId.includes("ble")) return "Bluetooth";
    return "WiFi";
  }

  _getStatusColor(status) {
    const colors = { online: "#4CAF50", offline: "#F44336", unavailable: "#9E9E9E" };
    return colors[status] || "#999";
  }

  _getBatteryColor(level) {
    if (level < 10) return "#FF1744";
    if (level < 30) return "#FF6D00";
    return "#4CAF50";
  }

  _getSignalColor(rssi) {
    if (rssi > -50) return "#4CAF50";
    if (rssi > -70) return "#8BC34A";
    if (rssi > -80) return "#FFC107";
    return "#F44336";
  }

  _sortDevices(devices) {
    const sorted = [...devices];
    const dir = this._sortDirection === "asc" ? 1 : -1;
    sorted.sort((a, b) => {
      switch (this._sortBy) {
        case "name": return dir * a.name.localeCompare(b.name);
        case "type": return dir * a.type.localeCompare(b.type);
        case "status": return dir * a.status.localeCompare(b.status);
        case "lastSeen": return dir * (new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime());
        case "uptime": return dir * a.uptime.localeCompare(b.uptime);
        default: return dir * a.name.localeCompare(b.name);
      }
    });
    return sorted;
  }

  _getSortIndicator(column) {
    if (this._sortBy === column) {
      return this._sortDirection === "asc" ? " ^" : " ˇ";
    }
    return " ?";
  }

  _render() {
    const style = `
      :host {
        /* --primary-color inherited from HA theme */
        --primary-text-color: var(--primary-text-color, var(--primary-text-color, #e1e1e1));
        --secondary-text-color: var(--secondary-text-color, var(--secondary-text-color, #9e9e9e));
        --divider-color: var(--divider-color, var(--divider-color, #333));
        --error-color: var(--error-color, #f44336);
      }

      * {
        box-sizing: border-box;
      }

      .card {
        background: var(--ha-card-background, white);
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        padding: 16px;
        font-family: Roboto, sans-serif;
      }

      .card-header {
        font-size: 24px;
        font-weight: 500;
        margin-bottom: 16px;
        color: var(--primary-text-color);
      }

      .tabs {
          display: flex;
          gap: 8px;
          border-bottom: 2px solid var(--divider-color, #333);
          margin-bottom: 20px;
          overflow-x: auto;
        }

      .tab {
          padding: 10px 16px;
          border: none;
          background: none;
          color: var(--secondary-text-color, #9e9e9e);
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          border-bottom: 3px solid transparent;
          transition: color 0.2s, border-color 0.2s;
          white-space: nowrap;
        }

      .tab.active {
          color: var(--primary-color, #03a9f4);
          border-bottom-color: var(--primary-color, #03a9f4);
        }

      .tab:hover {
          color: var(--primary-text-color, #e1e1e1);
        }

      .tab-content {
        display: none;
      }

      .tab-content.active {
        display: block;
      }

      .controls {
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
        flex-wrap: wrap;
        align-items: center;
      }

      .control-group {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      input[type="text"], select {
        padding: 8px 12px;
        border: 1px solid var(--divider-color);
        border-radius: 6px;
        font-size: 14px;
        background: var(--ha-card-background, white);
        color: var(--primary-text-color);
      }

      input[type="text"]::placeholder {
        color: var(--secondary-text-color);
      }

      button {
        padding: 8px 12px;
        border: 1px solid var(--divider-color);
        background: var(--ha-card-background, white);
        color: var(--primary-text-color);
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
      }

      button:hover {
        background: var(--divider-color);
      }

      button.active {
        background: var(--primary-color);
        color: white;
        border-color: var(--primary-color);
      }

      .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        color: white;
      }

      .status-online {
        background: #4CAF50;
      }

      .status-offline {
        background: #F44336;
      }

      .status-unavailable {
        background: #9E9E9E;
      }

      .device-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        margin-bottom: 16px;
      }

      .device-table th {
        text-align: left;
        padding: 10px 12px;
        border-bottom: 2px solid var(--divider-color, #333);
        background: var(--table-row-alternative-background-color, #2a2a2a);
        font-weight: 600;
        font-size: 13px;
        color: var(--primary-text-color, #e1e1e1);
        cursor: pointer;
        user-select: none;
        white-space: nowrap;
      }

      .device-table th:hover {
        background: var(--divider-color, #444);
      }

      .device-table th.sorted {
        background: #c8c8c8;
        color: var(--primary-color);
      }

      .device-table td {
        padding: 6px 12px;
        border-bottom: 1px solid var(--divider-color, #333);
        color: var(--primary-text-color, #e1e1e1);
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .device-table tr:hover {
        background: var(--table-row-alternative-background-color, #2a2a2a);
      }

      .stats {
        padding: 12px;
        background: var(--divider-color);
        border-radius: 4px;
        margin-bottom: 16px;
        font-size: 14px;
      }

      .battery-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 16px;
        margin-bottom: 16px;
      }

      .battery-card {
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        padding: 12px;
        text-align: center;
        transition: all 0.2s;
      }

      .battery-card:hover {
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
      }

      .battery-bar {
        width: 100%;
        height: 20px;
        background: var(--divider-color);
        border-radius: 10px;
        overflow: hidden;
        margin: 8px 0;
      }

      .battery-fill {
        height: 100%;
        transition: all 0.3s;
      }

      .battery-label {
        font-size: 12px;
        color: var(--secondary-text-color);
        margin-top: 8px;
      }

      .network-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px;
        margin-bottom: 16px;
      }

      .network-stat {
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        padding: 12px;
        text-align: center;
      }

      .network-stat-value {
        font-size: 24px;
        font-weight: bold;
        color: var(--primary-color);
      }

      .network-stat-label {
        font-size: 12px;
        color: var(--secondary-text-color);
        margin-top: 4px;
      }

      .rssi-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 8px 0;
        padding: 8px;
        background: var(--divider-color);
        border-radius: 4px;
      }

      .rssi-value {
        min-width: 50px;
        font-weight: 600;
      }

      .rssi-indicator {
        width: 100%;
        height: 8px;
        background: var(--divider-color);
        border-radius: 4px;
        overflow: hidden;
      }

      .rssi-fill {
        height: 100%;
        transition: all 0.3s;
      }

      .alert-item {
        padding: 12px;
        border-left: 4px solid;
        border-radius: 4px;
        margin-bottom: 8px;
        background: var(--divider-color);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .alert-critical {
        border-color: #F44336;
      }

      .alert-warning {
        border-color: #FFC107;
      }

      .alert-info {
        border-color: var(--primary-color, #03a9f4);
      }

      .alert-text {
        flex: 1;
      }

      .alert-type {
        font-weight: 600;
        font-size: 12px;
        margin-bottom: 4px;
      }

      .alert-time {
        font-size: 12px;
        color: var(--secondary-text-color);
      }

      .alert-actions {
        display: flex;
        gap: 8px;
      }

      .alert-dismiss {
        padding: 4px 8px;
        font-size: 12px;
        background: var(--error-color);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }

      .alert-dismiss:hover {
        opacity: 0.8;
      }

      canvas {
        width: 100%;
        height: 300px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        margin-bottom: 16px;
      }

      .empty-state {
        text-align: center;
        padding: 40px 16px;
        color: var(--secondary-text-color);
      }

      .health-score {
        font-size: 48px;
        font-weight: bold;
        color: var(--primary-color);
        text-align: center;
        margin: 20px 0;
      }

      .pagination {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 12px;
        margin-top: 20px;
        padding: 16px;
        border-top: 1px solid var(--divider-color);
      }

      .pagination-btn {
        padding: 8px 16px;
        border: 1px solid var(--divider-color);
        background: var(--ha-card-background, white);
        color: var(--primary-text-color);
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
      }

      .pagination-btn:hover:not(:disabled) {
        background: var(--primary-color);
        color: white;
        border-color: var(--primary-color);
      }

      .pagination-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .pagination-info {
        font-size: 14px;
        color: var(--primary-text-color);
        min-width: 120px;
        text-align: center;
        font-weight: 500;
      }

      .page-size-selector {
        padding: 8px 12px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        font-size: 14px;
        background: var(--ha-card-background, white);
        color: var(--primary-text-color);
        cursor: pointer;
      }

      .page-size-selector:hover {
        border-color: var(--primary-color);
      }

      /* Domain group header */
      .domain-group-header {
        padding: 10px 12px;
        background: var(--primary-color);
        color: white;
        font-weight: 600;
        font-size: 14px;
        text-transform: capitalize;
        margin-top: 12px;
        border-radius: 4px 4px 0 0;
      }

      .domain-group-header:first-child {
        margin-top: 0;
      }

      .domain-group-count {
        font-weight: 400;
        font-size: 12px;
        opacity: 0.8;
        margin-left: 8px;
      }

      /* Alert history table */
      .alert-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 16px;
      }

      .alert-table th {
        text-align: left;
        padding: 12px;
        border-bottom: 2px solid var(--divider-color);
        font-weight: 600;
        color: var(--primary-text-color);
        background: var(--divider-color);
        cursor: pointer;
        user-select: none;
        white-space: nowrap;
        font-size: 13px;
      }

      .alert-table th:hover {
        background: var(--divider-color, #444);
      }

      .alert-table th.sorted {
        background: #c8c8c8;
        color: var(--primary-color);
      }

      .alert-table td {
        padding: 8px 12px;
        border-bottom: 1px solid var(--divider-color);
        color: var(--primary-text-color);
        font-size: 13px;
      }

      .alert-table tr:hover {
        background: var(--divider-color);
      }

      .severity-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 600;
        color: white;
      }

      .severity-critical {
        background: #F44336;
      }

      .severity-warning {
        background: #FFC107;
        color: #333;
      }

      .severity-info {
        background: var(--primary-color, #03a9f4);
      }

      .alert-search-box {
        flex: 1;
        min-width: 150px;
        padding: 6px 12px;
        border: 1px solid var(--divider-color, var(--divider-color, #333));
        border-radius: 4px;
        background: var(--card-background-color, var(--card-background-color, #1e1e1e));
        color: var(--primary-text-color, #333);
        font-size: 13px;
      }

      .alert-filter-type,
      .alert-filter-severity {
        padding: 6px 12px;
        border: 1px solid var(--divider-color, var(--divider-color, #333));
        border-radius: 4px;
        background: var(--card-background-color, var(--card-background-color, #1e1e1e));
        color: var(--primary-text-color, #333);
        font-size: 13px;
        cursor: pointer;
      }

      .alert-table .alert-dismiss {
        padding: 3px 10px;
        font-size: 11px;
        border-radius: 4px;
        border: 1px solid var(--divider-color, var(--divider-color, #333));
        background: var(--card-background-color, var(--card-background-color, #1e1e1e));
        color: var(--primary-text-color, #333);
        cursor: pointer;
      }

      .alert-table .alert-dismiss:hover {
        background: #F44336;
        color: white;
        border-color: #F44336;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;

    const devices = this._getDevices();
    const batteries = this._getBatteryDevices();
    const networks = this._getNetworkDevices();
    const online = devices.filter((d) => d.status === "online").length;
    const availability = ((online / devices.length) * 100).toFixed(1);

    const batteryNeedingAttention = batteries.filter((b) => b.level < this._config.battery_warning).length;

    // Get unique domains for filter
    const allDomains = [...new Set(devices.map(d => d.domain))].sort();

    let html = `
      <div class="card">
        <div class="card-header">${this._config.title}</div>
        <div class="tabs">
          <button class="tab ${this._activeTab === "devices" ? "active" : ""}" data-tab="devices">${this._t('devices')}</button>
          <button class="tab ${this._activeTab === "batteries" ? "active" : ""}" data-tab="batteries">${this._t('batteries')}</button>
          <button class="tab ${this._activeTab === "network" ? "active" : ""}" data-tab="network">${this._t('network')}</button>
          <button class="tab ${this._activeTab === "alerts" ? "active" : ""}" data-tab="alerts">${this._t('alerts')}</button>
        </div>
    `;

    // Devices Tab - apply filters
    let filteredDevices = devices.filter(
      (d) => (this._deviceFilter === "all" || d.status === this._deviceFilter) &&
              (this._domainFilter === "all" || d.domain === this._domainFilter) &&
              d.name.toLowerCase().includes(this._searchQuery.toLowerCase())
    );

    // Sort devices
    filteredDevices = this._sortDevices(filteredDevices);

    // Pagination
    const totalPages = Math.ceil(filteredDevices.length / this._pageSize) || 1;
    if (this._currentPage > totalPages) {
      this._currentPage = 1;
    }

    const startIdx = (this._currentPage - 1) * this._pageSize;
    const endIdx = startIdx + this._pageSize;
    const paginatedDevices = filteredDevices.slice(startIdx, endIdx);

    html += `
      <div class="tab-content ${this._activeTab === "devices" ? "active" : ""}">
        <div class="controls">
          <div class="control-group">
            <input type="text" class="search-box" placeholder="${this._t('searchDevices')}" value="${this._searchQuery}">
          </div>
          <div class="control-group">
            <select class="filter-status">
              <option value="all" ${this._deviceFilter === "all" ? "selected" : ""}>${this._t('all')}</option>
              <option value="online" ${this._deviceFilter === "online" ? "selected" : ""}>${this._t('online')}</option>
              <option value="offline" ${this._deviceFilter === "offline" ? "selected" : ""}>${this._t('offline')}</option>
              <option value="unavailable" ${this._deviceFilter === "unavailable" ? "selected" : ""}>${this._t('unavailable')}</option>
            </select>
          </div>
          <div class="control-group">
            <select class="filter-domain">
              <option value="all" ${this._domainFilter === "all" ? "selected" : ""}>${this._t('allTypes')}</option>
              ${allDomains.map(d => `<option value="${d}" ${this._domainFilter === d ? "selected" : ""}>${d}</option>`).join("")}
            </select>
          </div>
          <div class="control-group">
            <button class="toggle-grouping ${this._groupByDomain ? 'active' : ''}">${this._t('toggleGrouping')}: ${this._groupByDomain ? this._t('grouped') : this._t('flat')}</button>
          </div>
          <div class="control-group">
            <select class="page-size-selector">
              <option value="15" ${this._pageSize === 15 ? "selected" : ""}>15 ${this._t('itemsPerPage')}</option>
              <option value="30" ${this._pageSize === 30 ? "selected" : ""}>30 ${this._t('itemsPerPage')}</option>
              <option value="50" ${this._pageSize === 50 ? "selected" : ""}>50 ${this._t('itemsPerPage')}</option>
              <option value="100" ${this._pageSize === 100 ? "selected" : ""}>100 ${this._t('itemsPerPage')}</option>
            </select>
          </div>
        </div>
        <div class="stats">
          ${this._t('totalDevices')}: ${devices.length} | ${this._t('online')}: ${online} | ${this._t('availability')}: ${availability}%
        </div>
    `;

    if (this._groupByDomain) {
      // Grouped view
      const grouped = {};
      paginatedDevices.forEach(d => {
        if (!grouped[d.domain]) grouped[d.domain] = [];
        grouped[d.domain].push(d);
      });

      Object.keys(grouped).sort().forEach(domain => {
        const domainDevices = grouped[domain];
        html += `
          <div class="domain-group-header">${domain}<span class="domain-group-count">(${domainDevices.length})</span></div>
          <table class="device-table">
            <thead>
              <tr>
                <th data-sort="name" class="${this._sortBy === 'name' ? 'sorted' : ''}">${this._t('name')}${this._getSortIndicator('name')}</th>
                <th data-sort="type" class="${this._sortBy === 'type' ? 'sorted' : ''}">${this._t('type')}${this._getSortIndicator('type')}</th>
                <th data-sort="status" class="${this._sortBy === 'status' ? 'sorted' : ''}">${this._t('status')}${this._getSortIndicator('status')}</th>
                <th data-sort="lastSeen" class="${this._sortBy === 'lastSeen' ? 'sorted' : ''}">${this._t('lastSeen')}${this._getSortIndicator('lastSeen')}</th>
                <th data-sort="uptime" class="${this._sortBy === 'uptime' ? 'sorted' : ''}">${this._t('uptime')}${this._getSortIndicator('uptime')}</th>
              </tr>
            </thead>
            <tbody>
              ${domainDevices.map(device => `<tr>
                <td>${device.name}</td>
                <td>${device.type}</td>
                <td><span class="status-badge status-${device.status}">${device.status.toUpperCase()}</span></td>
                <td>${new Date(device.lastSeen).toLocaleString()}</td>
                <td>${device.uptime}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        `;
      });
    } else {
      // Flat view
      html += `
        <table class="device-table">
          <thead>
            <tr>
              <th data-sort="name" class="${this._sortBy === 'name' ? 'sorted' : ''}">${this._t('name')}${this._getSortIndicator('name')}</th>
              <th data-sort="type" class="${this._sortBy === 'type' ? 'sorted' : ''}">${this._t('type')}${this._getSortIndicator('type')}</th>
              <th data-sort="status" class="${this._sortBy === 'status' ? 'sorted' : ''}">${this._t('status')}${this._getSortIndicator('status')}</th>
              <th data-sort="lastSeen" class="${this._sortBy === 'lastSeen' ? 'sorted' : ''}">${this._t('lastSeen')}${this._getSortIndicator('lastSeen')}</th>
              <th data-sort="uptime" class="${this._sortBy === 'uptime' ? 'sorted' : ''}">${this._t('uptime')}${this._getSortIndicator('uptime')}</th>
            </tr>
          </thead>
          <tbody>
            ${paginatedDevices
              .map(
                (device) =>
                  `<tr>
                    <td>${device.name}</td>
                    <td>${device.type}</td>
                    <td><span class="status-badge status-${device.status}">${device.status.toUpperCase()}</span></td>
                    <td>${new Date(device.lastSeen).toLocaleString()}</td>
                    <td>${device.uptime}</td>
                  </tr>`
              )
              .join("")}
          </tbody>
        </table>
      `;
    }

    html += `
        <div class="pagination">
          <button class="pagination-btn pagination-prev" ${this._currentPage === 1 ? 'disabled' : ''}>${this._t('previous')}</button>
          <span class="pagination-info">${this._t('page')} ${this._currentPage} ${this._t('of')} ${totalPages} (${filteredDevices.length})</span>
          <button class="pagination-btn pagination-next" ${this._currentPage === totalPages ? 'disabled' : ''}>${this._t('next')}</button>
        </div>
      </div>
    `;

    // Batteries Tab
    const batteryDevicesByHealth = [...batteries].sort((a, b) => {
      if (this._batterySortBy === "level") return a.level - b.level;
      if (this._batterySortBy === "name") return a.name.localeCompare(b.name);
      return 0;
    });

    html += `
      <div class="tab-content ${this._activeTab === "batteries" ? "active" : ""}">
        <div class="controls">
          <div class="control-group">
            <select class="battery-sort">
              <option value="level" ${this._batterySortBy === "level" ? "selected" : ""}>${this._t('levelWorstFirst')}</option>
              <option value="name" ${this._batterySortBy === "name" ? "selected" : ""}>${this._t('name')}</option>
            </select>
          </div>
        </div>
        <div class="stats">
          ${this._t('batteryHealthSummary')}: ${batteryNeedingAttention} ${this._t('deviceNeedAttention')}
        </div>
        <div class="battery-grid">
          ${batteryDevicesByHealth
            .map(
              (battery) => {
                const color = this._getBatteryColor(battery.level);
                const animation = battery.level < 10 ? "animation: pulse 1s infinite;" : "";
                return `
                  <div class="battery-card">
                    <div style="font-size: 24px; margin-bottom: 8px;">??</div>
                    <div style="font-size: 14px; font-weight: 600; color: var(--primary-text-color);">${battery.name}</div>
                    <div class="battery-bar">
                      <div class="battery-fill" style="width: ${battery.level}%; background: ${color}; ${animation}"></div>
                    </div>
                    <div style="font-size: 18px; font-weight: bold; color: ${color};">${battery.level}%</div>
                    <div class="battery-label">${this._t('lastChanged')}: ${new Date(battery.lastChanged).toLocaleDateString()}</div>
                  </div>
                `;
              }
            )
            .join("")}
        </div>
      </div>
    `;

    // Network Tab
    const protocolCounts = {};
    let totalNetDevices = 0;
    Object.keys(networks).forEach((protocol) => {
      protocolCounts[protocol] = networks[protocol].length;
      totalNetDevices += networks[protocol].length;
    });

    html += `
      <div class="tab-content ${this._activeTab === "network" ? "active" : ""}">
        <div class="network-stats">
    `;

    Object.keys(protocolCounts).forEach((protocol) => {
      html += `
        <div class="network-stat">
          <div class="network-stat-value">${protocolCounts[protocol]}</div>
          <div class="network-stat-label">${protocol} ${this._t('networkDevices')}</div>
        </div>
      `;
    });

    html += `
        </div>
        <canvas id="signal-chart" width="400" height="300"></canvas>
    `;

    Object.keys(networks).forEach((protocol) => {
      html += `
        <h3 style="margin-top: 24px; color: var(--primary-text-color);">${protocol} Network (${networks[protocol].length})</h3>
      `;
      networks[protocol].forEach((device) => {
        const color = this._getSignalColor(device.rssi);
        const strength = Math.max(0, Math.min(100, ((device.rssi + 100) / 50) * 100));
        const extraInfo = device.ip ? ` (${device.ip})` : '';
        html += `
          <div style="margin-bottom: 12px;">
            <div style="font-size: 14px; font-weight: 600; margin-bottom: 4px;">${device.name}${extraInfo}</div>
            <div class="rssi-bar">
              <div class="rssi-value" style="color: ${color};">${device.rssi} dBm</div>
              <div class="rssi-indicator">
                <div class="rssi-fill" style="width: ${strength}%; background: ${color};"></div>
              </div>
            </div>
          </div>
        `;
      });
    });

    html += `
      </div>
    `;

    // Alerts Tab - helper function for sort indicators
    const alertSortIndicator = (col) => {
      if (this._alertSortBy === col) {
        return this._alertSortDirection === "asc" ? " ^" : " ˇ";
      }
      return " ?";
    };

    // Collect all unique alert types and severities for filter dropdowns
    const allAlertData = [...this._alerts, ...this._alertHistory];
    const alertTypeSet = new Set(allAlertData.map(a => a.type));
    const alertSeveritySet = new Set(allAlertData.map(a => a.severity));
    const alertTypes = [...alertTypeSet].sort();
    const alertSeverities = [...alertSeveritySet].sort();

    // Filter function for alerts
    const filterAlert = (alert) => {
      if (this._alertFilterType !== "all" && alert.type !== this._alertFilterType) return false;
      if (this._alertFilterSeverity !== "all" && alert.severity !== this._alertFilterSeverity) return false;
      if (this._alertSearchQuery) {
        const q = this._alertSearchQuery.toLowerCase();
        if (!alert.name.toLowerCase().includes(q) && !alert.type.toLowerCase().includes(q)) return false;
      }
      return true;
    };

    // Sort function for alerts
    const sortAlerts = (arr) => {
      return [...arr].sort((a, b) => {
        const dir = this._alertSortDirection === "asc" ? 1 : -1;
        switch (this._alertSortBy) {
          case "timestamp": return dir * (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          case "type": return dir * a.type.localeCompare(b.type);
          case "name": return dir * a.name.localeCompare(b.name);
          case "severity": {
            const order = { critical: 0, warning: 1, info: 2 };
            return dir * ((order[a.severity] || 99) - (order[b.severity] || 99));
          }
          default: return dir * (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        }
      });
    };

    // Filter and sort active alerts
    const filteredActiveAlerts = sortAlerts(this._alerts.filter(filterAlert));

    // Filter and sort history
    const filteredHistory = sortAlerts(this._alertHistory.filter(filterAlert));

    // Paginate active alerts
    const activeTotalPages = Math.ceil(filteredActiveAlerts.length / this._alertPageSize) || 1;
    if (this._alertCurrentPage > activeTotalPages) this._alertCurrentPage = activeTotalPages;
    const activeStartIdx = (this._alertCurrentPage - 1) * this._alertPageSize;
    const paginatedActiveAlerts = filteredActiveAlerts.slice(activeStartIdx, activeStartIdx + this._alertPageSize);

    // Paginate history on a separate page counter (reuse _alertHistoryPage)
    if (!this._alertHistoryPage) this._alertHistoryPage = 1;
    const historyTotalPages = Math.ceil(filteredHistory.length / this._alertPageSize) || 1;
    if (this._alertHistoryPage > historyTotalPages) this._alertHistoryPage = historyTotalPages;
    const historyStartIdx = (this._alertHistoryPage - 1) * this._alertPageSize;
    const paginatedHistory = filteredHistory.slice(historyStartIdx, historyStartIdx + this._alertPageSize);

    html += `
      <div class="tab-content ${this._activeTab === "alerts" ? "active" : ""}">

        <!-- Alert filters / search controls -->
        <div class="controls" style="margin-bottom: 16px;">
          <div class="control-group" style="flex-wrap: wrap; gap: 8px;">
            <input type="text" class="alert-search-box search-box" placeholder="${this._t('searchAlerts')}" value="${this._alertSearchQuery}" />
            <select class="alert-filter-type">
              <option value="all">${this._t('allAlertTypes')}</option>
              ${alertTypes.map(t => `<option value="${t}" ${this._alertFilterType === t ? "selected" : ""}>${t.replace(/_/g, " ")}</option>`).join("")}
            </select>
            <select class="alert-filter-severity">
              <option value="all">${this._t('allSeverities')}</option>
              ${alertSeverities.map(s => `<option value="${s}" ${this._alertFilterSeverity === s ? "selected" : ""}>${s}</option>`).join("")}
            </select>
            <select class="alert-page-size-selector">
              <option value="15" ${this._alertPageSize === 15 ? "selected" : ""}>15 ${this._t('itemsPerPage')}</option>
              <option value="30" ${this._alertPageSize === 30 ? "selected" : ""}>30 ${this._t('itemsPerPage')}</option>
              <option value="50" ${this._alertPageSize === 50 ? "selected" : ""}>50 ${this._t('itemsPerPage')}</option>
              <option value="100" ${this._alertPageSize === 100 ? "selected" : ""}>100 ${this._t('itemsPerPage')}</option>
            </select>
          </div>
        </div>

        <!-- Active Alerts Section -->
        <h3 style="color: var(--primary-text-color); margin: 0 0 8px 0;">${this._t('activeAlerts')} (${filteredActiveAlerts.length}${filteredActiveAlerts.length !== this._alerts.length ? ' / ' + this._alerts.length + ' ' + this._t('total') : ''})</h3>
    `;

    if (filteredActiveAlerts.length === 0) {
      html += `<div class="empty-state">${this._t('noActiveAlerts')}</div>`;
    } else {
      html += `
        <table class="alert-table">
          <thead>
            <tr>
              <th data-alert-sort="type" class="${this._alertSortBy === 'type' ? 'sorted' : ''}">${this._t('alertType')}${alertSortIndicator('type')}</th>
              <th data-alert-sort="name" class="${this._alertSortBy === 'name' ? 'sorted' : ''}">${this._t('device')}${alertSortIndicator('name')}</th>
              <th data-alert-sort="severity" class="${this._alertSortBy === 'severity' ? 'sorted' : ''}">${this._t('severity')}${alertSortIndicator('severity')}</th>
              <th data-alert-sort="timestamp" class="${this._alertSortBy === 'timestamp' ? 'sorted' : ''}">${this._t('time')}${alertSortIndicator('timestamp')}</th>
              <th style="width: 80px;"></th>
            </tr>
          </thead>
          <tbody>
            ${paginatedActiveAlerts.map(alert => {
              const alertId = `${alert.type}_${alert.id}`;
              return `
              <tr>
                <td>${alert.type.replace(/_/g, " ")}</td>
                <td>${alert.name}</td>
                <td><span class="severity-badge severity-${alert.severity}">${alert.severity}</span></td>
                <td>${new Date(alert.timestamp).toLocaleString()}</td>
                <td><button class="alert-dismiss" data-alert-id="${alertId}">${this._t('dismiss')}</button></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
        <div class="pagination">
          <button class="pagination-btn alert-active-prev" ${this._alertCurrentPage <= 1 ? 'disabled' : ''}>${this._t('previous')}</button>
          <span class="pagination-info">${this._t('page')} ${this._alertCurrentPage} ${this._t('of')} ${activeTotalPages} (${filteredActiveAlerts.length})</span>
          <button class="pagination-btn alert-active-next" ${this._alertCurrentPage >= activeTotalPages ? 'disabled' : ''}>${this._t('next')}</button>
        </div>
      `;
    }

    // Alert History Section
    html += `
      <h3 style="margin-top: 24px; color: var(--primary-text-color);">${this._t('alertHistory')} (${filteredHistory.length}${filteredHistory.length !== this._alertHistory.length ? ' / ' + this._alertHistory.length + ' ' + this._t('total') : ''})</h3>
    `;

    if (filteredHistory.length === 0) {
      html += `<div class="empty-state">No matching alert history</div>`;
    } else {
      html += `
        <table class="alert-table alert-history-table">
          <thead>
            <tr>
              <th data-alert-sort="type" class="${this._alertSortBy === 'type' ? 'sorted' : ''}">${this._t('alertType')}${alertSortIndicator('type')}</th>
              <th data-alert-sort="name" class="${this._alertSortBy === 'name' ? 'sorted' : ''}">${this._t('device')}${alertSortIndicator('name')}</th>
              <th data-alert-sort="severity" class="${this._alertSortBy === 'severity' ? 'sorted' : ''}">${this._t('severity')}${alertSortIndicator('severity')}</th>
              <th data-alert-sort="timestamp" class="${this._alertSortBy === 'timestamp' ? 'sorted' : ''}">${this._t('time')}${alertSortIndicator('timestamp')}</th>
            </tr>
          </thead>
          <tbody>
            ${paginatedHistory.map(alert => `
              <tr>
                <td>${alert.type.replace(/_/g, " ")}</td>
                <td>${alert.name}</td>
                <td><span class="severity-badge severity-${alert.severity}">${alert.severity}</span></td>
                <td>${new Date(alert.timestamp).toLocaleString()}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div class="pagination">
          <button class="pagination-btn alert-history-prev" ${this._alertHistoryPage <= 1 ? 'disabled' : ''}>${this._t('previous')}</button>
          <span class="pagination-info">${this._t('page')} ${this._alertHistoryPage} ${this._t('of')} ${historyTotalPages} (${filteredHistory.length})</span>
          <button class="pagination-btn alert-history-next" ${this._alertHistoryPage >= historyTotalPages ? 'disabled' : ''}>${this._t('next')}</button>
        </div>
      `;
    }

    html += `</div></div>`;


    this.shadowRoot.innerHTML = `<style>${style}</style>${html}`;
    this._attachEventListeners();
    this._drawSignalChart();
  }

  _attachEventListeners() {
    const tabs = this.shadowRoot.querySelectorAll(".tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", (e) => {
        this._activeTab = e.target.dataset.tab;
        this._render();
      });
    });

    const searchBox = this.shadowRoot.querySelector(".search-box");
    if (searchBox) {
      searchBox.addEventListener("input", (e) => {
        this._searchQuery = e.target.value;
        this._currentPage = 1;
        this._render();
      });
    }

    const filterStatus = this.shadowRoot.querySelector(".filter-status");
    if (filterStatus) {
      filterStatus.addEventListener("change", (e) => {
        this._deviceFilter = e.target.value;
        this._currentPage = 1;
        this._render();
      });
    }

    const filterDomain = this.shadowRoot.querySelector(".filter-domain");
    if (filterDomain) {
      filterDomain.addEventListener("change", (e) => {
        this._domainFilter = e.target.value;
        this._currentPage = 1;
        this._render();
      });
    }

    const toggleGrouping = this.shadowRoot.querySelector(".toggle-grouping");
    if (toggleGrouping) {
      toggleGrouping.addEventListener("click", () => {
        this._groupByDomain = !this._groupByDomain;
        this._render();
      });
    }

    const batterySort = this.shadowRoot.querySelector(".battery-sort");
    if (batterySort) {
      batterySort.addEventListener("change", (e) => {
        this._batterySortBy = e.target.value;
        this._render();
      });
    }

    const dismissButtons = this.shadowRoot.querySelectorAll(".alert-dismiss");
    dismissButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const alertId = e.target.dataset.alertId;
        this._acknowledgedAlerts.add(alertId);
        this._update();
      });
    });

    // Device table sort headers
    const sortHeaders = this.shadowRoot.querySelectorAll(".device-table th[data-sort]");
    sortHeaders.forEach((header) => {
      header.addEventListener("click", (e) => {
        const sortBy = e.target.closest('th').dataset.sort;
        if (this._sortBy === sortBy) {
          this._sortDirection = this._sortDirection === "asc" ? "desc" : "asc";
        } else {
          this._sortBy = sortBy;
          this._sortDirection = "asc";
        }
        this._render();
      });
    });

    // Alert search box
    const alertSearchBox = this.shadowRoot.querySelector(".alert-search-box");
    if (alertSearchBox) {
      alertSearchBox.addEventListener("input", (e) => {
        this._alertSearchQuery = e.target.value;
        this._alertCurrentPage = 1;
        this._alertHistoryPage = 1;
        this._render();
      });
    }

    // Alert filter by type
    const alertFilterType = this.shadowRoot.querySelector(".alert-filter-type");
    if (alertFilterType) {
      alertFilterType.addEventListener("change", (e) => {
        this._alertFilterType = e.target.value;
        this._alertCurrentPage = 1;
        this._alertHistoryPage = 1;
        this._render();
      });
    }

    // Alert filter by severity
    const alertFilterSeverity = this.shadowRoot.querySelector(".alert-filter-severity");
    if (alertFilterSeverity) {
      alertFilterSeverity.addEventListener("change", (e) => {
        this._alertFilterSeverity = e.target.value;
        this._alertCurrentPage = 1;
        this._alertHistoryPage = 1;
        this._render();
      });
    }

    // Alert table sort headers (both active and history tables)
    const alertSortHeaders = this.shadowRoot.querySelectorAll(".alert-table th[data-alert-sort]");
    alertSortHeaders.forEach((header) => {
      header.addEventListener("click", (e) => {
        const sortBy = e.target.closest('th').dataset.alertSort;
        if (this._alertSortBy === sortBy) {
          this._alertSortDirection = this._alertSortDirection === "asc" ? "desc" : "asc";
        } else {
          this._alertSortBy = sortBy;
          this._alertSortDirection = "asc";
        }
        this._render();
      });
    });

    const pageSizeSelector = this.shadowRoot.querySelector(".page-size-selector");
    if (pageSizeSelector) {
      pageSizeSelector.addEventListener("change", (e) => {
        this._pageSize = parseInt(e.target.value);
        this._currentPage = 1;
        this._render();
      });
    }

    const alertPageSizeSelector = this.shadowRoot.querySelector(".alert-page-size-selector");
    if (alertPageSizeSelector) {
      alertPageSizeSelector.addEventListener("change", (e) => {
        this._alertPageSize = parseInt(e.target.value);
        this._alertCurrentPage = 1;
        this._alertHistoryPage = 1;
        this._render();
      });
    }

    const prevBtn = this.shadowRoot.querySelector(".pagination-prev");
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (this._currentPage > 1) {
          this._currentPage--;
          this._render();
        }
      });
    }

    const nextBtn = this.shadowRoot.querySelector(".pagination-next");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        const filteredDevices = this._getDevices().filter(
          (d) => (this._deviceFilter === "all" || d.status === this._deviceFilter) &&
                  (this._domainFilter === "all" || d.domain === this._domainFilter) &&
                  d.name.toLowerCase().includes(this._searchQuery.toLowerCase())
        );
        const totalPages = Math.ceil(filteredDevices.length / this._pageSize) || 1;
        if (this._currentPage < totalPages) {
          this._currentPage++;
          this._render();
        }
      });
    }

    // Active alerts pagination
    const alertActivePrev = this.shadowRoot.querySelector(".alert-active-prev");
    if (alertActivePrev) {
      alertActivePrev.addEventListener("click", () => {
        if (this._alertCurrentPage > 1) {
          this._alertCurrentPage--;
          this._render();
        }
      });
    }

    const alertActiveNext = this.shadowRoot.querySelector(".alert-active-next");
    if (alertActiveNext) {
      alertActiveNext.addEventListener("click", () => {
        if (this._alertCurrentPage < Math.ceil(this._alerts.length / this._alertPageSize)) {
          this._alertCurrentPage++;
          this._render();
        }
      });
    }

    // Alert history pagination
    const alertHistoryPrev = this.shadowRoot.querySelector(".alert-history-prev");
    if (alertHistoryPrev) {
      alertHistoryPrev.addEventListener("click", () => {
        if (this._alertHistoryPage > 1) {
          this._alertHistoryPage--;
          this._render();
        }
      });
    }

    const alertHistoryNext = this.shadowRoot.querySelector(".alert-history-next");
    if (alertHistoryNext) {
      alertHistoryNext.addEventListener("click", () => {
        if (this._alertHistoryPage < Math.ceil(this._alertHistory.length / this._alertPageSize)) {
          this._alertHistoryPage++;
          this._render();
        }
      });
    }
  }

  _drawSignalChart() {
    const canvas = this.shadowRoot.querySelector("#signal-chart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const networks = this._getNetworkDevices();
    const allDevices = [];
    Object.keys(networks).forEach((protocol) => {
      networks[protocol].forEach((device) => {
        allDevices.push({ rssi: device.rssi, protocol });
      });
    });

    if (allDevices.length === 0) return;

    const width = rect.width;
    const height = rect.height;
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Draw axes
    ctx.strokeStyle = "#ccc";
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Create histogram
    const bins = 10;
    const histogram = new Array(bins).fill(0);
    const minRssi = -100;
    const maxRssi = -30;
    const binWidth = (maxRssi - minRssi) / bins;

    allDevices.forEach((device) => {
      const binIndex = Math.floor((device.rssi - minRssi) / binWidth);
      if (binIndex >= 0 && binIndex < bins) {
        histogram[binIndex]++;
      }
    });

    const maxCount = Math.max(...histogram);
    const barWidth = chartWidth / bins;

    // Draw bars
    ctx.fillStyle = "#03a9f4";
    histogram.forEach((count, i) => {
      const barHeight = (count / maxCount) * chartHeight;
      const x = padding + i * barWidth;
      const y = height - padding - barHeight;
      ctx.fillRect(x, y, barWidth * 0.9, barHeight);
    });

    // Draw labels
    ctx.fillStyle = "var(--secondary-text-color, #9e9e9e)";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    for (let i = 0; i <= bins; i++) {
      const rssi = minRssi + i * binWidth;
      const x = padding + i * barWidth;
      ctx.fillText(rssi.toFixed(0), x, height - padding + 20);
    }

    ctx.textAlign = "left";
    ctx.fillText(this._t('signalStrengthDist'), padding, padding - 10);
  }

  static getConfigElement() {
    const element = document.createElement("ha-device-health-editor");
    return element;
  }

  static getStubConfig() {
    return {
      type: "custom:ha-device-health",
      title: "Device Health",
      battery_warning: 30,
      battery_critical: 10,
      offline_alert_minutes: 60,
    };
  }
}

customElements.define("ha-device-health", HADeviceHealth);

// Auto-load HA Tools Panel (if not already registered)
if (!customElements.get('ha-tools-panel')) {
  const _currentScript = document.currentScript?.src || '';
  const _baseUrl = _currentScript.substring(0, _currentScript.lastIndexOf('/') + 1);
  if (_baseUrl) {
    const _s = document.createElement('script');
    _s.src = _baseUrl + 'ha-tools-panel.js';
    document.head.appendChild(_s);
  }
}

// Register with HA Tools Panel
window.haToolsRegistry = window.haToolsRegistry || [];
window.haToolsRegistry.push({
  type: 'ha-device-health',
  name: 'Device Health',
  description: 'Monitor device status, battery levels, network connectivity, and alerts',
  icon: '??',
  config: { type: 'custom:ha-device-health' }
});

window.dispatchEvent(new CustomEvent('ha-tools-card-registered', {
  detail: { type: 'ha-device-health' }
}));
