let emulatorInterval = null;
let lastVoltage;
let lastCurrent;
let lastUsbMinus;
let lastUsbPlus;
let lastTemperature;
let accumulatedAh;
let accumulatedWh;
let seconds;
let minutes;
let hours;

const INITIAL_VALUES = {
  lastVoltage: 5.0,
  lastCurrent: 1.5,
  lastUsbMinus: 2.4,
  lastUsbPlus: 2.6,
  lastTemperature: 22,
  accumulatedAh: 0,
  accumulatedWh: 0,
  seconds: 0,
  minutes: 0,
  hours: 0
};

function resetState() {
  lastVoltage = INITIAL_VALUES.lastVoltage;
  lastCurrent = INITIAL_VALUES.lastCurrent;
  lastUsbMinus = INITIAL_VALUES.lastUsbMinus;
  lastUsbPlus = INITIAL_VALUES.lastUsbPlus;
  lastTemperature = INITIAL_VALUES.lastTemperature;
  accumulatedAh = INITIAL_VALUES.accumulatedAh;
  accumulatedWh = INITIAL_VALUES.accumulatedWh;
  seconds = INITIAL_VALUES.seconds;
  minutes = INITIAL_VALUES.minutes;
  hours = INITIAL_VALUES.hours;
}

resetState();

function generateBoundedRandom(lastValue, min, max, maxDiff) {
  const minChange = Math.max(min, lastValue - maxDiff);
  const maxChange = Math.min(max, lastValue + maxDiff);
  return Math.random() * (maxChange - minChange) + minChange;
}

function generateRecord() {
  const voltage = generateBoundedRandom(lastVoltage, 4.7, 5.3, 0.1);
  lastVoltage = voltage;

  const current = generateBoundedRandom(lastCurrent, 1.0, 2.0, 0.1);
  lastCurrent = current;

  const usbMinus = generateBoundedRandom(lastUsbMinus, 2.1, 2.7, 0.1);
  lastUsbMinus = usbMinus;

  const usbPlus = generateBoundedRandom(lastUsbPlus, 2.3, 2.9, 0.1);
  lastUsbPlus = usbPlus;

  const temperature = Math.round(generateBoundedRandom(lastTemperature, 20, 25, 1));
  lastTemperature = temperature;

  const watt = voltage * current;

  accumulatedAh += current / 3600;
  accumulatedWh += watt / 3600;

  seconds += 1;
  if (seconds > 59) {
    seconds = 0;
    minutes += 1;
  }
  if (minutes > 59) {
    minutes = 0;
    hours += 1;
  }

  const voltageInt = Math.round(voltage * 100);
  const currentInt = Math.round(current * 100);
  const ahInt = Math.round(accumulatedAh * 1000);
  const whInt = Math.round(accumulatedWh * 100);
  const usbMinusInt = Math.round(usbMinus * 100);
  const usbPlusInt = Math.round(usbPlus * 100);

  const record = new Uint8Array(36);
  record.set([
    0xFF, 0x55,
    0x01, 0x03,
  ], 0);
  record.set([(voltageInt >> 16) & 0xFF, (voltageInt >> 8) & 0xFF, voltageInt & 0xFF], 4);
  record.set([(currentInt >> 16) & 0xFF, (currentInt >> 8) & 0xFF, currentInt & 0xFF], 7);
  record.set([(ahInt >> 16) & 0xFF, (ahInt >> 8) & 0xFF, ahInt & 0xFF], 10);
  record.set([(whInt >> 24) & 0xFF, (whInt >> 16) & 0xFF, (whInt >> 8) & 0xFF, whInt & 0xFF], 13);
  record.set([(usbMinusInt >> 8) & 0xFF, usbMinusInt & 0xFF], 17);
  record.set([(usbPlusInt >> 8) & 0xFF, usbPlusInt & 0xFF], 19);
  record.set([(temperature >> 8) & 0xFF, temperature & 0xFF], 21);
  record.set([(hours >> 8) & 0xFF, hours & 0xFF], 23);
  record.set([minutes], 25);
  record.set([seconds], 26);
  record.set([0x3C, 0x0C], 27);
  record.set([0x80, 0x00], 29);
  record.set([0x00, 0x03, 0x20, 0x00], 31);

  let sum = 0;
  for (let i = 2; i < 35; i++) {
    sum += record[i];
  }
  record[35] = (sum & 0xFF) ^ 0x44;

  return record;
}

self.onmessage = function (e) {
  const { command } = e.data;
  if (command === 'start') {
    resetState();
    emulatorInterval = setInterval(() => {
      const record = generateRecord();
      self.postMessage({ record });
    }, 1000);
  } else if (command === 'stop') {
    if (emulatorInterval) {
      clearInterval(emulatorInterval);
      emulatorInterval = null;
    }
  } else if (command === 'reset') {
    resetState();
  }
};