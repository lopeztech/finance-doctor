'use client';

import dynamic from 'next/dynamic';

const ApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

const TYPE_COLORS: Record<string, string> = {
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

interface Props {
  allocations: [string, number][];
  height?: number;
}

export default function AllocationChart({ allocations, height = 300 }: Props) {
  const labels = allocations.map(([type]) => type);
  const series = allocations.map(([, value]) => value);
  const colors = allocations.map(([type]) => TYPE_COLORS[type] || '#6c757d');

  const options = {
    chart: { type: 'donut' as const, animations: { enabled: false } },
    labels,
    colors,
    legend: { position: 'bottom' as const, fontSize: '13px' },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => val.toFixed(1) + '%',
      style: { fontSize: '12px', fontWeight: 600 },
    },
    tooltip: {
      y: {
        formatter: (val: number) => '$' + val.toLocaleString('en-AU', { minimumFractionDigits: 2 }),
      },
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
              fontSize: '14px',
              formatter: (w: { globals: { seriesTotals: number[] } }) => {
                const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                return '$' + total.toLocaleString('en-AU', { maximumFractionDigits: 0 });
              },
            },
          },
        },
      },
    },
    responsive: [
      {
        breakpoint: 576,
        options: { legend: { fontSize: '11px' }, dataLabels: { style: { fontSize: '10px' } } },
      },
    ],
  };

  return <ApexChart options={options} series={series} type="donut" height={height} />;
}
