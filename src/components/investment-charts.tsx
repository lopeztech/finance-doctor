'use client';

import dynamic from 'next/dynamic';

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

const TYPE_COLOR: Record<string, string> = {
  'Australian Shares': '#0d6efd',
  'International Shares': '#0dcaf0',
  'ETFs': '#20c997',
  'Bonds': '#ffc107',
  'Property': '#dc3545',
  'Cryptocurrency': '#fd7e14',
  'Cash / Term Deposit': '#198754',
  'Superannuation': '#6610f2',
  'Other': '#6c757d',
};

interface CostVsValueProps {
  byType: Record<string, { cost: number; value: number }>;
  height?: number;
}

export function CostVsValueChart({ byType, height = 320 }: CostVsValueProps) {
  const entries = Object.entries(byType).sort(([, a], [, b]) => b.value - a.value);
  const categories = entries.map(([t]) => t);
  const cost = entries.map(([, v]) => Number(v.cost.toFixed(2)));
  const value = entries.map(([, v]) => Number(v.value.toFixed(2)));

  const options = {
    chart: { type: 'bar' as const, toolbar: { show: false }, animations: { enabled: false }, stacked: false },
    plotOptions: { bar: { horizontal: false, columnWidth: '55%', borderRadius: 4 } },
    colors: ['#adb5bd', '#0d6efd'],
    dataLabels: { enabled: false },
    stroke: { show: true, width: 2, colors: ['transparent'] },
    xaxis: { categories, labels: { style: { fontSize: '11px' }, rotate: -30, trim: true } },
    yaxis: {
      labels: {
        formatter: (val: number) => '$' + val.toLocaleString('en-AU', { maximumFractionDigits: 0 }),
      },
    },
    legend: { position: 'top' as const, fontSize: '12px' },
    tooltip: {
      y: { formatter: (val: number) => '$' + val.toLocaleString('en-AU', { minimumFractionDigits: 2 }) },
    },
    grid: { borderColor: '#e7e7e7' },
  };

  const series = [
    { name: 'Cost Basis', data: cost },
    { name: 'Current Value', data: value },
  ];

  return <ApexChart options={options} series={series} type="bar" height={height} />;
}

interface GainLossProps {
  items: { name: string; type: string; gainLoss: number; returnPct: number }[];
  height?: number;
  limit?: number;
}

export function GainLossChart({ items, height = 320, limit = 10 }: GainLossProps) {
  const sorted = [...items].sort((a, b) => Math.abs(b.gainLoss) - Math.abs(a.gainLoss)).slice(0, limit);
  const labels = sorted.map(i => i.name.length > 24 ? i.name.slice(0, 24) + '…' : i.name);
  const values = sorted.map(i => Number(i.gainLoss.toFixed(2)));
  const colors = sorted.map(i => i.gainLoss >= 0 ? '#198754' : '#dc3545');

  const options = {
    chart: { type: 'bar' as const, toolbar: { show: false }, animations: { enabled: false } },
    plotOptions: {
      bar: { horizontal: true, distributed: true, borderRadius: 4, barHeight: '70%' },
    },
    colors,
    dataLabels: {
      enabled: true,
      textAnchor: 'start' as const,
      formatter: (val: number) => (val >= 0 ? '+$' : '-$') + Math.abs(val).toLocaleString('en-AU', { maximumFractionDigits: 0 }),
      style: { fontSize: '11px', colors: ['#333'] },
    },
    legend: { show: false },
    xaxis: {
      categories: labels,
      labels: {
        formatter: (val: string) => '$' + parseFloat(val).toLocaleString('en-AU', { maximumFractionDigits: 0 }),
      },
    },
    tooltip: {
      custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
        const item = sorted[dataPointIndex];
        const sign = item.gainLoss >= 0 ? '+' : '-';
        return `<div class="px-2 py-1">
          <div class="fw-bold small">${item.name}</div>
          <div class="text-muted small">${item.type}</div>
          <div>${sign}$${Math.abs(item.gainLoss).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
          <span class="small text-muted">(${item.returnPct >= 0 ? '+' : ''}${item.returnPct.toFixed(1)}%)</span></div>
        </div>`;
      },
    },
    grid: { borderColor: '#e7e7e7' },
  };

  return <ApexChart options={options} series={[{ name: 'Gain/Loss', data: values }]} type="bar" height={height} />;
}

interface OwnerAllocationProps {
  byOwner: Record<string, number>;
  height?: number;
}

export function OwnerAllocationChart({ byOwner, height = 280 }: OwnerAllocationProps) {
  const entries = Object.entries(byOwner).sort(([, a], [, b]) => b - a);
  const labels = entries.map(([o]) => o);
  const values = entries.map(([, v]) => Number(v.toFixed(2)));
  // Stable palette; recycle if > 6 owners
  const palette = ['#0d6efd', '#20c997', '#fd7e14', '#6610f2', '#dc3545', '#ffc107', '#0dcaf0', '#198754'];
  const colors = labels.map((_, i) => palette[i % palette.length]);

  const options = {
    chart: { type: 'donut' as const, animations: { enabled: false } },
    labels,
    colors,
    legend: { position: 'bottom' as const, fontSize: '12px' },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => val.toFixed(0) + '%',
      style: { fontSize: '11px' },
    },
    tooltip: {
      y: { formatter: (val: number) => '$' + val.toLocaleString('en-AU', { minimumFractionDigits: 2 }) },
    },
    plotOptions: {
      pie: {
        donut: {
          size: '60%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Total',
              fontSize: '13px',
              formatter: (w: { globals: { seriesTotals: number[] } }) => {
                const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                return '$' + total.toLocaleString('en-AU', { maximumFractionDigits: 0 });
              },
            },
          },
        },
      },
    },
  };

  return <ApexChart options={options} series={values} type="donut" height={height} />;
}

interface ReturnByTypeProps {
  byType: Record<string, { cost: number; value: number }>;
  height?: number;
}

export function ReturnByTypeChart({ byType, height = 300 }: ReturnByTypeProps) {
  const entries = Object.entries(byType)
    .filter(([, v]) => v.cost > 0)
    .map(([t, v]) => ({ type: t, pct: ((v.value - v.cost) / v.cost) * 100 }))
    .sort((a, b) => b.pct - a.pct);
  const labels = entries.map(e => e.type);
  const values = entries.map(e => Number(e.pct.toFixed(2)));
  const colors = entries.map(e => TYPE_COLOR[e.type] || '#6c757d');

  const options = {
    chart: { type: 'bar' as const, toolbar: { show: false }, animations: { enabled: false } },
    plotOptions: {
      bar: { horizontal: true, distributed: true, borderRadius: 4, barHeight: '70%' },
    },
    colors,
    dataLabels: {
      enabled: true,
      textAnchor: 'start' as const,
      formatter: (val: number) => (val >= 0 ? '+' : '') + val.toFixed(1) + '%',
      style: { fontSize: '11px', colors: ['#333'] },
    },
    legend: { show: false },
    xaxis: {
      categories: labels,
      labels: { formatter: (val: string) => parseFloat(val).toFixed(0) + '%' },
    },
    tooltip: {
      y: { formatter: (val: number) => (val >= 0 ? '+' : '') + val.toFixed(2) + '%' },
    },
    grid: { borderColor: '#e7e7e7' },
  };

  return <ApexChart options={options} series={[{ name: 'Return', data: values }]} type="bar" height={height} />;
}
