const connectBtn = document.getElementById('connectBtn');
const connectEmulatorBtn = document.getElementById('connectEmulatorBtn');
const reconnectBtn = document.getElementById('reconnectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const resetCountersBtn = document.getElementById('resetCountersBtn');
const noBluetoothCard = document.getElementById('noBluetoothCard');
const closeCardBtn = document.getElementById('closeCardBtn');

let device = null;
let characteristic = null;
let lastTotalSeconds = null;
let lastDeviceName = null;
let isEmulator = false;
let emulatorWorker = null;
let queuedRecords = [];

function parseMeasurementData(data) {
  const bytes = new Uint8Array(data.buffer);
  if (bytes[0] !== 0xFF || bytes[1] !== 0x55 || bytes[3] !== 0x03) return null;

  return {
    voltage: (bytes[4] << 16 | bytes[5] << 8 | bytes[6]) / 100,
    current: (bytes[7] << 16 | bytes[8] << 8 | bytes[9]) / 100,
    ah: (bytes[10] << 16 | bytes[11] << 8 | bytes[12]) / 1000,
    wh: (bytes[13] << 24 | bytes[14] << 16 | bytes[15] << 8 | bytes[16]) / 100,
    usbMinus: (bytes[17] << 8 | bytes[18]) / 100,
    usbPlus: (bytes[19] << 8 | bytes[20]) / 100,
    temperature: (bytes[21] << 8 | bytes[22]),
    hour: (bytes[23] << 8 | bytes[24]),
    minute: bytes[25],
    second: bytes[26],
    totalSeconds: ((bytes[23] << 8 | bytes[24]) * 3600) + (bytes[25] * 60) + bytes[26],
    rawBytes: Array.from(bytes)
  };
}

async function sendResetCommand() {
  if (!characteristic && !isEmulator) {
    logStatus("Error: Not connected to device");
    return;
  }

  if (isEmulator) {
    if (emulatorWorker) {
      emulatorWorker.postMessage({ command: 'reset' });
    }
    resetCharts();
    logStatus("Emulator counters reset");
    return;
  }

  const cmdPacket = new Uint8Array([0xFF, 0x55, 0x11, 0x03, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00]);
  let sum = 0;
  for (let i = 2; i < cmdPacket.length - 1; i++) sum += cmdPacket[i];
  cmdPacket[cmdPacket.length - 1] = (sum & 0xFF) ^ 0x44;

  try {
    await characteristic.writeValue(cmdPacket);
    logStatus(`Sent reset command: 05`);
  } catch (error) {
    logStatus(`Write error for reset command: ${error.message}`);
  }
}

function updateButtonStates(isConnected) {
  connectBtn.disabled = isConnected;
  connectEmulatorBtn.disabled = isConnected;
  reconnectBtn.disabled = isConnected || !lastDeviceName;
  disconnectBtn.disabled = !isConnected;
  resetCountersBtn.disabled = !isConnected;
}

function handleNotifications(event) {
  const record = event.target ? event.target.value : event;
  const m = parseMeasurementData(record);
  if (m) {
    if (lastTotalSeconds !== null && m.totalSeconds < lastTotalSeconds) {
      resetCharts();
      logStatus('Graphs reset due to decreased totalSeconds');
    }
    lastTotalSeconds = m.totalSeconds;

    const power = (m.voltage * m.current).toFixed(2);

    logDataRow(
      `${m.voltage.toFixed(3)} ${m.current.toFixed(3)} ` +
      `${power} ${m.ah.toFixed(3)} ` +
      `${m.wh.toFixed(3)} ${m.usbMinus.toFixed(2)} ` +
      `${m.usbPlus.toFixed(2)} ${m.temperature} ` +
      `${m.totalSeconds.toString().padEnd(6)} ` +
      m.rawBytes.map(b => b.toString(16).padStart(2, '0')).join(' ')
    );

    updateCharts({
      time: m.totalSeconds,
      voltage: m.voltage,
      current: m.current,
      watt: power,
      usbMinus: m.usbMinus,
      usbPlus: m.usbPlus,
      ah: m.ah,
      wh: m.wh
    });

    updateButtonStates(true);
  }
}

function processQueuedRecords() {
  if (document.visibilityState === 'visible') {
    queuedRecords.forEach(record => handleNotifications(record));
    queuedRecords = [];
  }
}

function connectEmulator() {
  resetCharts();
  resetLog();
  lastTotalSeconds = null;
  isEmulator = true;
  logStatus('Connecting to emulator...');

  emulatorWorker = new Worker('js/emulator.js');
  emulatorWorker.onmessage = (e) => {
    const { record } = e.data;
    if (document.visibilityState === 'visible') {
      handleNotifications(record);
    } else {
      queuedRecords.push(record);
    }
  };
  emulatorWorker.postMessage({ command: 'start' });

  logStatus('Connected to emulator');
  updateButtonStates(true);
}

async function connect() {
  if (!navigator.bluetooth) {
    logStatus('Error: navigator.bluetooth is undefined');
    noBluetoothCard.style.display = 'flex';
    return;
  }

  try {
    resetCharts();
    resetLog();
    lastTotalSeconds = null;
    device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['0000ffe0-0000-1000-8000-00805f9b34fb']
    });

    if (!device) {
      logStatus('No device selected');
      return;
    }

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb');
    characteristic = await service.getCharacteristic('0000ffe1-0000-1000-8000-00805f9b34fb');

    characteristic.addEventListener('characteristicvaluechanged', (event) => {
      if (document.visibilityState === 'visible') {
        handleNotifications(event);
      } else {
        queuedRecords.push(event.target.value);
      }
    });

    await characteristic.startNotifications();
    lastDeviceName = device.name || 'Unnamed';
    reconnectBtn.textContent = `Reconnect to ${lastDeviceName}`;
    logStatus('Connected. Receiving data...');
    updateButtonStates(true);
    isEmulator = false;
  } catch (error) {
    logStatus(`Error: ${error.message}`);
    if (device && device.gatt && device.gatt.connected) {
      device.gatt.disconnect();
    }
    device = null;
    characteristic = null;
    lastDeviceName = null;
    reconnectBtn.textContent = 'Reconnect';
    updateButtonStates(false);
  }
}

async function reconnect() {
  try {
    if (!lastDeviceName) {
      logStatus('No previous device to reconnect to');
      return;
    }

    const devices = await navigator.bluetooth.getDevices();
    device = devices.find(d => d.name === lastDeviceName);
    if (!device) {
      logStatus(`Device ${lastDeviceName} not found`);
      lastDeviceName = null;
      reconnectBtn.textContent = 'Reconnect';
      updateButtonStates(false);
      return;
    }

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb');
    characteristic = await service.getCharacteristic('0000ffe1-0000-1000-8000-00805f9b34fb');

    characteristic.addEventListener('characteristicvaluechanged', (event) => {
      if (document.visibilityState === 'visible') {
        handleNotifications(event);
      } else {
        queuedRecords.push(event.target.value);
      }
    });

    await characteristic.startNotifications();
    logStatus(`Reconnected to ${lastDeviceName}. Receiving data...`);
    updateButtonStates(true);
    isEmulator = false;
  } catch (error) {
    logStatus(`Reconnect error: ${error.message}`);
    if (device && device.gatt && device.gatt.connected) {
      device.gatt.disconnect();
    }
    device = null;
    characteristic = null;
    lastDeviceName = null;
    reconnectBtn.textContent = 'Reconnect';
    updateButtonStates(false);
  }
}

async function disconnect() {
  try {
    if (isEmulator) {
      if (emulatorWorker) {
        emulatorWorker.postMessage({ command: 'stop' });
        emulatorWorker.terminate();
        emulatorWorker = null;
      }
      queuedRecords = [];
      isEmulator = false;
      logStatus('Disconnected from emulator');
      updateButtonStates(false);
      return;
    }

    if (!device || !device.gatt || !device.gatt.connected) {
      logStatus('No active connection to disconnect');
      return;
    }
    if (characteristic) {
      await characteristic.stopNotifications();
      characteristic.removeEventListener('characteristicvaluechanged', handleNotifications);
      logStatus('Notifications stopped');
    }
    device.gatt.disconnect();
    logStatus('Disconnected');
    device = null;
    characteristic = null;
    queuedRecords = [];
    updateButtonStates(false);
  } catch (error) {
    logStatus(`Disconnect error: ${error.message}`);
    device = null;
    characteristic = null;
    queuedRecords = [];
    updateButtonStates(false);
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    processQueuedRecords();
  }
});

connectBtn.addEventListener('click', connect);
connectEmulatorBtn.addEventListener('click', connectEmulator);
reconnectBtn.addEventListener('click', reconnect);
disconnectBtn.addEventListener('click', disconnect);
resetCountersBtn.addEventListener('click', sendResetCommand);
closeCardBtn.addEventListener('click', () => {
  noBluetoothCard.style.display = 'none';
});