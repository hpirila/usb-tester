const debugOutput = document.getElementById('debugOutput');
const statusOutput = document.getElementById('statusOutput');
const saveCsvBtn = document.getElementById('saveCsvBtn');
const csvFilenameInput = document.getElementById('csvFilename');

const dataRows = [];

function logDataRow(data) {
  const row = document.createElement('div');
  row.textContent = data;
  debugOutput.appendChild(row);
  debugOutput.scrollTop = debugOutput.scrollHeight;
  dataRows.push(data);
}

function logStatus(message) {
  const row = document.createElement('div');
  row.textContent = message;
  statusOutput.appendChild(row);
  statusOutput.scrollTop = statusOutput.scrollHeight;
}

function resetLog() {
  debugOutput.innerHTML = '';
  statusOutput.innerHTML = '';
  dataRows.length = 0;
}

function saveToCSV() {
  const headers = 'Voltage,Current,Power,Ah,Wh,USB-,USB+,T,t,Raw';
  const csvRows = [headers];

  dataRows.forEach(row => {
    const values = row.trim().split(/\s+/);
    if (values.length >= 10) {
      const voltage = values[0];
      const current = values[1];
      const power = values[2];
      const ah = values[3];
      const wh = values[4];
      const usbMinus = values[5];
      const usbPlus = values[6];
      const temperature = values[7];
      const seconds = values[8];
      const rawBytes = values.slice(9).join(' ');
      csvRows.push(`${voltage},${current},${power},${ah},${wh},${usbMinus},${usbPlus},${temperature},${seconds},${rawBytes}`);
    }
  });

  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const filename = csvFilenameInput.value || 'USB_Tester.csv';
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

saveCsvBtn.addEventListener('click', saveToCSV);