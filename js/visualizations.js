function showLoading(chartId) {
    document.getElementById(`${chartId}-loading`).classList.remove('hidden');
}

function hideLoading(chartId) {
    document.getElementById(`${chartId}-loading`).classList.add('hidden');
}

function initializeCharts(challenge) {
    try {
        showLoading('chart');
        showLoading('significance');

        const conversionCtx = document.getElementById('conversion-chart').getContext('2d');
        const significanceCtx = document.getElementById('significance-chart').getContext('2d');

        // Conversion rates over time chart
        new Chart(conversionCtx, {
            type: 'line',
            data: {
                labels: Array.from({length: challenge.experiment.businessCycleDays}, (_, i) => `Day ${i + 1}`),
                datasets: [{
                    label: 'Base Variant',
                    data: challenge.simulation.dailyData.map(d => d.base),
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true
                }, {
                    label: 'Test Variant',
                    data: challenge.simulation.dailyData.map(d => d.variant),
                    borderColor: 'rgb(239, 68, 68)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Daily Conversion Rates'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${(context.raw * 100).toFixed(2)}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Conversion Rate (%)'
                        },
                        ticks: {
                            callback: function(value) {
                                return (value * 100).toFixed(1) + '%';
                            }
                        }
                    }
                }
            }
        });

        // P-value visualization with scalar value
        new Chart(significanceCtx, {
            type: 'bar',
            data: {
                labels: ['P-Value'],
                datasets: [{
                    label: 'Current P-Value',
                    data: [challenge.simulation.pValue],
                    backgroundColor: challenge.simulation.pValue < 0.05 ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)',
                    borderColor: challenge.simulation.pValue < 0.05 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Statistical Significance'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const pValue = context.raw;
                                return `P-Value: ${pValue.toFixed(4)}${pValue < 0.05 ? ' (Significant)' : ''}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 1,
                        title: {
                            display: true,
                            text: 'P-Value'
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error initializing charts:', error);
        document.getElementById('conversion-chart').innerHTML = 'Error loading chart';
        document.getElementById('significance-chart').innerHTML = 'Error loading chart';
    } finally {
        hideLoading('chart');
        hideLoading('significance');
    }
}

// Make sure charts resize properly
window.addEventListener('resize', function() {
    const charts = Chart.getChart('conversion-chart');
    if (charts) charts.resize();
    const sigChart = Chart.getChart('significance-chart');
    if (sigChart) sigChart.resize();
});