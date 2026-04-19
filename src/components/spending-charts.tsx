'use client';

import dynamic from 'next/dynamic';

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface CategoryDonutProps {
  totals: Record<string, number>;
  colors: Record<string, string>;
  height?: number;
}

export function CategoryDonut({ totals, colors, height = 300 }: CategoryDonutProps) {
  const sorted = Object.entries(totals).sort(([, a], [, b]) => b - a);
  const labels = sorted.map(([cat]) => cat);
  const values = sorted.map(([, v]) => Number(v.toFixed(2)));
  const palette = sorted.map(([cat]) => colors[cat] || '#6c757d');

  const options = {
    chart: { type: 'donut' as const, toolbar: { show: false }, animations: { enabled: false } },
    labels,
    colors: palette,
    legend: { position: 'right' as const, fontSize: '12px' },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => `${val.toFixed(0)}%`,
      style: { fontSize: '11px' },
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
              formatter: () => '$' + values.reduce((s, v) => s + v, 0).toLocaleString('en-AU', { maximumFractionDigits: 0 }),
            },
          },
        },
      },
    },
    tooltip: {
      y: { formatter: (val: number) => '$' + val.toLocaleString('en-AU', { minimumFractionDigits: 2 }) },
    },
    responsive: [
      { breakpoint: 768, options: { legend: { position: 'bottom' as const, fontSize: '10px' } } },
    ],
  };

  return <ApexChart options={options} series={values} type="donut" height={height} />;
}

interface MonthlyTrendProps {
  monthlyTotals: Record<string, number>;
  height?: number;
  variant?: 'area' | 'line';
}

export function MonthlyTrend({ monthlyTotals, height = 300, variant = 'area' }: MonthlyTrendProps) {
  const entries = Object.entries(monthlyTotals).sort(([a], [b]) => a.localeCompare(b));
  const labels = entries.map(([m]) => {
    const d = new Date(m + '-01');
    return d.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' });
  });
  const values = entries.map(([, v]) => Number(v.toFixed(2)));
  const avg = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;

  const isLine = variant === 'line';
  const options = {
    chart: { type: isLine ? ('line' as const) : ('area' as const), toolbar: { show: false }, animations: { enabled: false } },
    stroke: { curve: 'smooth' as const, width: isLine ? 3 : 2 },
    ...(isLine ? {} : {
      fill: {
        type: 'gradient',
        gradient: { shadeIntensity: 1, opacityFrom: 0.5, opacityTo: 0.05, stops: [0, 100] },
      },
    }),
    markers: isLine ? { size: 5, strokeWidth: 2, hover: { sizeOffset: 3 } } : { size: 0 },
    colors: ['#0d6efd'],
    dataLabels: { enabled: false },
    xaxis: { categories: labels, labels: { style: { fontSize: '11px' } } },
    yaxis: {
      labels: {
        formatter: (val: number) => '$' + val.toLocaleString('en-AU', { maximumFractionDigits: 0 }),
      },
    },
    annotations: avg > 0 ? {
      yaxis: [{
        y: avg,
        borderColor: '#dc3545',
        strokeDashArray: 4,
        label: {
          borderColor: '#dc3545',
          style: { color: '#fff', background: '#dc3545', fontSize: '11px' },
          text: `Avg $${avg.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`,
        },
      }],
    } : undefined,
    tooltip: {
      y: { formatter: (val: number) => '$' + val.toLocaleString('en-AU', { minimumFractionDigits: 2 }) },
    },
    grid: { borderColor: '#e7e7e7' },
  };

  return <ApexChart options={options} series={[{ name: 'Spend', data: values }]} type={isLine ? 'line' : 'area'} height={height} />;
}

interface TopVendorsProps {
  vendors: { description: string; total: number; category: string }[];
  colors: Record<string, string>;
  height?: number;
  limit?: number;
}

export function TopVendorsChart({ vendors, colors, height = 300, limit = 10 }: TopVendorsProps) {
  const top = [...vendors]
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
  const labels = top.map(v => v.description.length > 30 ? v.description.slice(0, 30) + '…' : v.description);
  const values = top.map(v => Number(v.total.toFixed(2)));
  const palette = top.map(v => colors[v.category] || '#6c757d');

  const options = {
    chart: { type: 'bar' as const, toolbar: { show: false }, animations: { enabled: false } },
    plotOptions: {
      bar: { horizontal: true, borderRadius: 4, distributed: true, barHeight: '70%' },
    },
    colors: palette,
    dataLabels: {
      enabled: true,
      textAnchor: 'start' as const,
      formatter: (val: number) => '$' + val.toLocaleString('en-AU', { maximumFractionDigits: 0 }),
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
      y: {
        formatter: (val: number) => '$' + val.toLocaleString('en-AU', { minimumFractionDigits: 2 }),
        title: { formatter: () => '' },
      },
    },
    grid: { borderColor: '#e7e7e7' },
  };

  return <ApexChart options={options} series={[{ name: 'Spend', data: values }]} type="bar" height={height} />;
}
