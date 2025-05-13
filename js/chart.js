const charts = {};
let chartCount = 2;
let nextDatasetIdx = 1;

const backgroundPlugin = {
  id: 'customBackground',
  beforeDraw: (chart) => {
    const ctx = chart.canvas.getContext('2d');
    ctx.save();
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, chart.canvas.width, chart.canvas.height);
    ctx.restore();
  }
};

const chartConfigs = {
  multi: {
    canvasId: 'chart-0',
    label: 'Measurements',
    datasets: [
      {
        label: 'Voltage (V)',
        borderColor: 'blue',
        data: [],
        yAxisID: 'y0',
        hidden: false
      },
      {
        label: 'Current (A)',
        borderColor: 'red',
        data: [],
        yAxisID: 'y1',
        hidden: false
      },
      {
        label: 'Power (W)',
        borderColor: 'green',
        data: [],
        yAxisID: 'y2',
        hidden: false
      },
      {
        label: 'USB- (V)',
        borderColor: 'magenta',
        data: [],
        yAxisID: 'y3',
        hidden: true
      },
      {
        label: 'USB+ (V)',
        borderColor: 'cyan',
        data: [],
        yAxisID: 'y4',
        hidden: true
      },
      {
        label: 'Ah',
        borderColor: 'purple',
        data: [],
        yAxisID: 'y5',
        hidden: false
      },
      {
        label: 'Wh',
        borderColor: 'orange',
        data: [],
        yAxisID: 'y6',
        hidden: false
      }
    ]
  }
};

const checkboxes = {
  v: { datasetIdx: 0, yAxisID: 'y0', position: 'left', title: 'Voltage (V)', label: 'V' },
  a: { datasetIdx: 1, yAxisID: 'y1', position: 'left', title: 'Current (A)', label: 'A' },
  w: { datasetIdx: 2, yAxisID: 'y2', position: 'left', title: 'Power (W)', label: 'W' },
  usbMinus: { datasetIdx: 3, yAxisID: 'y3', position: 'left', title: 'USB- (V)', label: 'USB-' },
  usbPlus: { datasetIdx: 4, yAxisID: 'y4', position: 'left', title: 'USB+ (V)', label: 'USB+' },
  ah: { datasetIdx: 5, yAxisID: 'y5', position: 'left', title: 'Ah', label: 'Ah' },
  wh: { datasetIdx: 6, yAxisID: 'y6', position: 'left', title: 'Wh', label: 'Wh' }
};

function resetCharts() {
  Object.keys(charts).forEach(key => {
    const chart = charts[key];
    if (chart) {
      chart.data.datasets.forEach(dataset => dataset.data = []);
      chart.update();
    }
  });
}

function updateCharts(data) {
  Object.keys(charts).forEach(key => {
    const chart = charts[key];
    if (chart) {
      chart.data.datasets[0].data.push({ x: data.time, y: data.voltage });
      chart.data.datasets[1].data.push({ x: data.time, y: data.current });
      chart.data.datasets[2].data.push({ x: data.time, y: data.watt });
      chart.data.datasets[3].data.push({ x: data.time, y: data.usbMinus });
      chart.data.datasets[4].data.push({ x: data.time, y: data.usbPlus });
      chart.data.datasets[5].data.push({ x: data.time, y: data.ah });
      chart.data.datasets[6].data.push({ x: data.time, y: data.wh });
      const times = chart.data.datasets[0].data.map(d => d.x);
      chart.options.scales.x.min = Math.min(...times);
      chart.options.scales.x.max = Math.max(...times);
      chart.update();
    }
  });
}

function saveChart(chartId) {
  const chart = charts[chartId];
  if (chart) {
    const filename = document.querySelector(`.save-btn[data-chart="${chartId}"]`).nextElementSibling.value;
    const link = document.createElement('a');
    link.href = chart.toBase64Image();
    link.download = filename;
    link.click();
  } else {
    console.error(`Chart ${chartId} not initialized`);
  }
}

function updateChartScales(chartId) {
  const multiChart = charts[chartId];
  if (!multiChart) return;
    const checkedKeys = Object.keys(checkboxes).filter(key => document.getElementById(`${chartId}-${key}`).checked);

  const positions = {};
  if (checkedKeys.length === 2) {
    positions[checkedKeys[0]] = 'left';
    positions[checkedKeys[1]] = 'right';
  } else {
    checkedKeys.forEach(key => positions[key] = 'left');
  }

  Object.keys(checkboxes).forEach(key => {
    const cb = document.getElementById(`${chartId}-${key}`);
    const { datasetIdx, yAxisID } = checkboxes[key];
    multiChart.setDatasetVisibility(datasetIdx, cb.checked);
    multiChart.options.scales[yAxisID].display = cb.checked;
    multiChart.options.scales[yAxisID].position = positions[key] || 'left';
  });
  multiChart.update();
}

function getChartFilename(chartId) {
  const checkedLabels = Object.keys(checkboxes)
    .filter(key => document.getElementById(`${chartId}-${key}`).checked)
    .map(key => checkboxes[key].label.replace('+', 'Plus').replace('-', 'Minus'));
  return checkedLabels.length > 0 ? `${checkedLabels.join('')}.png` : 'Chart.png';
}

function initializeChart(chartId, enabledDatasetIdx = null) {
  const canvas = document.getElementById(chartId);
  if (!canvas) {
    console.error(`Canvas not found for chart ${chartId}`);
    return;
  }
  const ctx = canvas.getContext('2d');
  const isInitialChart = chartId === 'chart-0' || chartId === 'chart-1';
  const initialChecked = isInitialChart && chartId === 'chart-0' ? ['v', 'a', 'w', 'ah', 'wh'] :
    isInitialChart && chartId === 'chart-1' ? ['v'] : [];

  charts[chartId] = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: chartConfigs.multi.datasets.map(dataset => ({ ...dataset, data: [] }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'Time (s)' },
          ticks: {
            stepSize: 1,
            precision: 0
          }
        },
        y0: {
          type: 'linear',
          id: 'y0',
          beginAtZero: true,
          title: { display: true, text: 'Voltage (V)' },
          position: 'left',
          display: chartId === 'chart-0' || enabledDatasetIdx === 0 || (chartId === 'chart-1' && enabledDatasetIdx === null),
          grid: { drawOnChartArea: true }
        },
        y1: {
          type: 'linear',
          id: 'y1',
          beginAtZero: true,
          title: { display: true, text: 'Current (A)' },
          position: 'left',
          display: chartId === 'chart-0' || enabledDatasetIdx === 1,
          grid: { drawOnChartArea: false }
        },
        y2: {
          type: 'linear',
          id: 'y2',
          beginAtZero: true,
          title: { display: true, text: 'Power (W)' },
          position: 'left',
          display: chartId === 'chart-0' || enabledDatasetIdx === 2,
          grid: { drawOnChartArea: false }
        },
        y3: {
          type: 'linear',
          id: 'y3',
          beginAtZero: true,
          title: { display: true, text: 'USB- (V)' },
          position: 'left',
          display: enabledDatasetIdx === 3,
          grid: { drawOnChartArea: false }
        },
        y4: {
          type: 'linear',
          id: 'y4',
          beginAtZero: true,
          title: { display: true, text: 'USB+ (V)' },
          position: 'left',
          display: enabledDatasetIdx === 4,
          grid: { drawOnChartArea: false }
        },
        y5: {
          type: 'linear',
          id: 'y5',
          beginAtZero: true,
          title: { display: true, text: 'Ah' },
          position: 'left',
          display: chartId === 'chart-0' || enabledDatasetIdx === 5,
          grid: { drawOnChartArea: false }
        },
        y6: {
          type: 'linear',
          id: 'y6',
          beginAtZero: true,
          title: { display: true, text: 'Wh' },
          position: 'left',
          display: chartId === 'chart-0' || enabledDatasetIdx === 6,
          grid: { drawOnChartArea: false }
        }
      },
      plugins: {
        legend: {
          display: true,
          onClick: () => { },
          labels: {
            generateLabels: function (chart) {
              const datasets = chart.data.datasets;
              const labels = [];
              Object.keys(checkboxes).forEach(key => {
                const cb = document.getElementById(`${chartId}-${key}`);
                const { datasetIdx, label } = checkboxes[key];
                if (cb.checked && datasets[datasetIdx]) {
                  labels.push({
                    text: datasets[datasetIdx].label,
                    fillStyle: datasets[datasetIdx].borderColor,
                    datasetIndex: datasetIdx,
                    hidden: false
                  });
                }
              });
              return labels;
            }
          }
        }
      }
    },
    plugins: [backgroundPlugin]
  });

  const filenameInput = document.querySelector(`#${chartId}-wrapper .chart-filename`);
  filenameInput.value = getChartFilename(chartId);

  updateChartScales(chartId);

  document.querySelectorAll(`#${chartId}-wrapper .checkboxes input[type="checkbox"]`).forEach(cb => {
    cb.addEventListener('change', () => {
      updateChartScales(chartId);
      filenameInput.value = getChartFilename(chartId);
    });
  });
  document.querySelector(`#${chartId}-wrapper .save-chart-btn`).addEventListener('click', () => saveChart(chartId));
  document.querySelector(`#${chartId}-wrapper .expand-btn`).addEventListener('click', () => {
    document.getElementById(`${chartId}-wrapper`).classList.add('expanded');
    charts[chartId].resize();
  });
  document.querySelector(`#${chartId}-wrapper .collapse-btn`).addEventListener('click', () => {
    document.getElementById(`${chartId}-wrapper`).classList.remove('expanded');
    charts[chartId].resize();
  });
  const removeBtn = document.querySelector(`#${chartId}-wrapper .remove-btn`);
  removeBtn.addEventListener('click', () => {
    document.getElementById(`${chartId}-wrapper`).remove();
    charts[chartId].destroy();
    delete charts[chartId];
  });
}

function createChart(index, enabledDatasetIdx) {
  const chartId = `chart-${index}`;
  const wrapper = document.createElement('div');
  wrapper.className = 'chart-wrapper';
  wrapper.id = `${chartId}-wrapper`;

  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-btn';
  removeBtn.dataset.chart = chartId;
  removeBtn.textContent = '✖';

  const expandBtn = document.createElement('button');
  expandBtn.className = 'expand-btn';
  expandBtn.dataset.chart = chartId;
  expandBtn.textContent = '🡕';

  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'collapse-btn';
  collapseBtn.dataset.chart = chartId;
  collapseBtn.textContent = '🡗';

  const canvas = document.createElement('canvas');
  canvas.id = chartId;

  const controls = document.createElement('div');
  controls.className = 'chart-controls';

  const checkboxesDiv = document.createElement('div');
  checkboxesDiv.className = 'checkboxes';
  Object.keys(checkboxes).forEach(key => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = `${chartId}-${key}`;
    input.checked = enabledDatasetIdx !== null && checkboxes[key].datasetIdx === enabledDatasetIdx;
    label.appendChild(input);
    label.appendChild(document.createTextNode(checkboxes[key].label));
    checkboxesDiv.appendChild(label);
  });

  const saveControls = document.createElement('div');
  saveControls.className = 'save-controls';
  const saveBtn = document.createElement('button');
  saveBtn.className = 'save-btn save-chart-btn';
  saveBtn.dataset.chart = chartId;
  saveBtn.textContent = 'Save';
  const filenameInput = document.createElement('input');
  filenameInput.type = 'text';
  filenameInput.className = 'chart-filename';
  saveControls.appendChild(saveBtn);
  saveControls.appendChild(filenameInput);

  controls.appendChild(checkboxesDiv);
  controls.appendChild(saveControls);

  wrapper.appendChild(removeBtn);
  wrapper.appendChild(expandBtn);
  wrapper.appendChild(collapseBtn);
  wrapper.appendChild(canvas);
  wrapper.appendChild(controls);

  const graphGrid = document.querySelector('.graph-grid');
  graphGrid.appendChild(wrapper);

  initializeChart(chartId, enabledDatasetIdx);
}

document.addEventListener('DOMContentLoaded', () => {
  initializeChart('chart-0');
  initializeChart('chart-1', 0);

  document.getElementById('addChartBtn').addEventListener('click', () => {
    createChart(chartCount, nextDatasetIdx);
    chartCount++;
    nextDatasetIdx = (nextDatasetIdx + 1) % 7;
  });
});