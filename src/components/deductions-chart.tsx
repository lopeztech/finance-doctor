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
  categoryTotals: Record<string, number>;
  height?: number;
}

export default function DeductionsChart({ categoryTotals, height = 320 }: Props) {
  const sorted = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a);
  const labels = sorted.map(([cat]) => cat);
  const values = sorted.map(([, total]) => total);
  const colors = sorted.map(([cat]) => CATEGORY_COLORS[cat] || '#6c757d');

  const options = {
    chart: { type: 'bar' as const, toolbar: { show: false }, animations: { enabled: false } },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4,
        distributed: true,
        dataLabels: { position: 'top' as const },
      },
    },
    colors,
    dataLabels: {
      enabled: true,
      textAnchor: 'start' as const,
      offsetX: 0,
      formatter: (val: number) => '$' + val.toLocaleString('en-AU', { maximumFractionDigits: 0 }),
      style: { fontSize: '12px', colors: ['#333'] },
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

  return (
    <ApexChart
      options={options}
      series={[{ name: 'Deductions', data: values }]}
      type="bar"
      height={height}
    />
  );
}
