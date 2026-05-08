const chartRegistry = new Map();

export function destroyChart(id) {
  const chart = chartRegistry.get(id);
  if (chart) {
    chart.destroy();
    chartRegistry.delete(id);
  }
}

export function destroyCharts(prefix = '') {
  Array.from(chartRegistry.keys()).forEach((id) => {
    if (!prefix || id.startsWith(prefix)) destroyChart(id);
  });
}

export function createChart(canvas, config = {}) {
  if (!canvas || !window.Chart) return null;
  const id = canvas.id || `차트_${Date.now()}`;
  canvas.id = id;
  destroyChart(id);
  const theme = getChartTheme();
  const merged = mergeChartOptions(config, theme);
  const chart = new window.Chart(canvas, merged);
  chartRegistry.set(id, chart);
  return chart;
}

export function createBarChart(canvas, { labels = [], datasets = [], horizontal = true, stacked = false, onClick } = {}) {
  return createChart(canvas, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      indexAxis: horizontal ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: true },
      scales: {
        x: { stacked, beginAtZero: true },
        y: { stacked }
      },
      onClick: onClick || undefined
    }
  });
}

export function createDoughnutChart(canvas, { labels = [], data = [], onClick } = {}) {
  return createChart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, borderWidth: 2 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      onClick: onClick || undefined
    }
  });
}

export function cssVar(name, fallback = '#6B7280') {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function palette() {
  return [
    cssVar('--stage-tm'),
    cssVar('--stage-material'),
    cssVar('--stage-evd-scheduled'),
    cssVar('--stage-evd-done'),
    cssVar('--stage-proposal'),
    cssVar('--stage-contract-review'),
    cssVar('--priority-a'),
    cssVar('--tag-info'),
    cssVar('--tag-positive'),
    cssVar('--tag-warning')
  ];
}

function getChartTheme() {
  return {
    text: cssVar('--text'),
    muted: cssVar('--text-muted'),
    border: cssVar('--border'),
    surface: cssVar('--surface'),
    colors: palette()
  };
}

function mergeChartOptions(config, theme) {
  const options = config.options || {};
  const datasets = (config.data?.datasets || []).map((dataset, index) => ({
    borderRadius: dataset.borderRadius ?? 8,
    borderSkipped: false,
    backgroundColor: dataset.backgroundColor || theme.colors[index % theme.colors.length],
    borderColor: dataset.borderColor || 'transparent',
    ...dataset
  }));

  return {
    ...config,
    data: {
      ...(config.data || {}),
      datasets
    },
    options: {
      plugins: {
        legend: {
          display: true,
          labels: { color: theme.text, boxWidth: 12, boxHeight: 12, usePointStyle: true }
        },
        tooltip: {
          backgroundColor: theme.surface,
          titleColor: theme.text,
          bodyColor: theme.text,
          borderColor: theme.border,
          borderWidth: 1,
          padding: 12
        },
        ...(options.plugins || {})
      },
      scales: options.scales ? Object.fromEntries(Object.entries(options.scales).map(([key, scale]) => [key, {
        grid: { color: theme.border },
        ticks: { color: theme.muted, precision: 0 },
        ...(scale || {})
      }])) : undefined,
      ...options
    }
  };
}
