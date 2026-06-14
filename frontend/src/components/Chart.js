import React, { useEffect, useRef } from 'react';
import Chartjs from 'chart.js/auto';

const Chart = ({ results, comparisonData, comparisonCompartment }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }
    if (!results && !comparisonData) return;

    const ctx = chartRef.current.getContext('2d');
    const datasets = [];
    let timeLabels = [];

    if (results?.time) {
      timeLabels = results.time;
    } else if (comparisonData) {
      const firstSuccess = comparisonData.find(item => item.data && item.data.time);
      timeLabels = firstSuccess ? firstSuccess.data.time : [];
    }

    if (results) {
      const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'];
      const labels = { s: 'S', e: 'E', i: 'I', h: 'H', r: 'R' };
      ['s', 'e', 'i', 'h', 'r'].forEach((comp, idx) => {
        if (results[comp]) {
          datasets.push({
            label: labels[comp],
            data: results[comp],
            borderColor: colors[idx % colors.length],
            backgroundColor: 'transparent',
            tension: 0.1
          });
        }
      });
    }

    if (comparisonData) {
      const palette = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f'];
      const comp = comparisonCompartment || 'i';
      comparisonData.forEach((item, idx) => {
        if (item.error || !item.data || !item.data[comp]) return;
        const color = palette[idx % palette.length];
        const compLabel = { s: 'S', e: 'E', i: 'I', h: 'H', r: 'R' }[comp] || comp.toUpperCase();
        datasets.push({
          label: `${item.label} (${compLabel})`,
          data: item.data[comp],
          borderColor: color,
          backgroundColor: 'transparent',
          borderDash: idx % 2 === 0 ? [] : [6, 3],
          tension: 0.1
        });
      });
    }

    chartInstance.current = new Chartjs(ctx, {
      type: 'line',
      data: {
        labels: timeLabels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: { mode: 'index' },
          legend: { position: 'top' }
        },
        scales: {
          x: { title: { display: true, text: 'Дни' } },
          y: { title: { display: true, text: 'Численность' } }
        }
      }
    });

    return () => {
      if (chartInstance.current) chartInstance.current.destroy();
    };
  }, [results, comparisonData, comparisonCompartment]);

  return (
    <div style={{ height: '450px', width: '90%', margin: '20px auto' }}>
      <canvas ref={chartRef} />
    </div>
  );
};

export default Chart;