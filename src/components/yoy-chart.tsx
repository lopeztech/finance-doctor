'use client';

import dynamic from 'next/dynamic';

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

const CATEGORY_COLORS: Record<string, string> = {
  'Work from Home': '#20c997',
  'Vehicle & Travel': '#0d6efd',
  'Clothing & Laundry': '#6f42c1',
  'Self-Education': '#fd7e14',
  'Tools & Equipment': '#6610f2',
  'Professional Memberships': '#0dcaf0',
  'Phone & Internet': '#198754',
  'Donations': '#dc3545',
  'Investment Expenses': '#ffc107',
  'Investment Property': '#795548',
  'Other Deductions': '#6c757d',
};

interface Props {
  /** Per-FY category totals: { '2024-2025': { 'Work from Home': 500, ... }, ... } */
  byFy: Record<string, Record<string, number>>;
  height?: number;
}

export default function YoyChart({ byFy, height = 360 }: Props) {
  const fys = Object.keys(byFy).sort();
  const categories = Array.from(
    new Set(fys.flatMap(fy => Object.keys(byFy[fy])))
  ).sort();

  const series = categories.map(cat => ({
    name: cat,
    data: fys.map(fy => Number((byFy[fy][cat] ?? 0).toFixed(2))),
  }));

  const colors = categories.map(cat => CATEGORY_COLORS[cat] || '#6c757d');

  const options = {
    chart: { type: 'bar' as const, stacked: true, toolbar: { show: false }, animations: { enabled: false } },
    plotOptions: { bar: { horizontal: false, borderRadius: 4, columnWidth: '55%' } },
    colors,
    dataLabels: { enabled: false },
    legend: { position: 'bottom' as const, fontSize: '12px' },
    xaxis: {
      categories: fys.map(fy => `FY ${fy}`),
      labels: { style: { fontSize: '12px' } },
    },
    yaxis: {
      labels: {
        formatter: (val: number) => '$' + val.toLocaleString('en-AU', { maximumFractionDigits: 0 }),
      },
    },
    tooltip: {
      y: { formatter: (val: number) => '$' + val.toLocaleString('en-AU', { minimumFractionDigits: 2 }) },
    },
    grid: { borderColor: '#e7e7e7' },
    responsive: [
      { breakpoint: 576, options: { legend: { fontSize: '10px' }, plotOptions: { bar: { columnWidth: '75%' } } } },
    ],
  };

  return <ApexChart options={options} series={series} type="bar" height={height} />;
}
