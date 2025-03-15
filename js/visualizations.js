function showLoading(chartId) {
    document.getElementById(`${chartId}-loading`).classList.remove('hidden');
}

function hideLoading(chartId) {
    document.getElementById(`${chartId}-loading`).classList.add('hidden');
}

function initializeCharts(challenge) {
    try {
        updateConfidenceIntervals(challenge);
        renderConversionChart(challenge);
    } catch (error) {
        console.error('Error initializing visualizations:', error);
    }
}

function updateConfidenceIntervals(challenge) {
    // Helper function to format percentage
    const formatPercent = (value) => (value * 100).toFixed(2) + '%';

    // Find the range for all intervals to determine view bounds
    const allValues = [
        ...challenge.simulation.confidenceIntervalBase,
        ...challenge.simulation.confidenceIntervalVariant,
        ...challenge.simulation.confidenceIntervalDifference,
        challenge.simulation.actualBaseConversionRate,
        challenge.simulation.variantConversionRate
    ];

    const minValue = Math.min(...allValues);
    const maxValue = Math.max(...allValues);
    const padding = (maxValue - minValue) * 0.2; // Add 20% padding

    const viewMin = Math.max(0, minValue - padding);
    const viewMax = Math.min(1, maxValue + padding);
    const viewRange = viewMax - viewMin;

    // Helper function to convert actual value to view percentage
    const toViewPercent = (value) => ((value - viewMin) / viewRange) * 100;

    // Helper function to set CI visualization
    function updateCIVisualization(containerId, low, high, mean, color) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container ${containerId} not found`);
            return;
        }

        const range = container.querySelector(`.bg-${color}-200`);
        const marker = container.querySelector(`.bg-${color}-600`);

        if (!range || !marker) {
            console.error(`Required elements not found in ${containerId}`);
            return;
        }

        // Calculate positions in view space
        const lowPercent = toViewPercent(low);
        const highPercent = toViewPercent(high);
        const meanPercent = toViewPercent(mean);

        // Update range and marker positions with a transition
        range.style.transition = 'all 0.3s ease-in-out';
        marker.style.transition = 'all 0.3s ease-in-out';

        range.style.left = `${lowPercent}%`;
        range.style.width = `${highPercent - lowPercent}%`;
        marker.style.left = `${meanPercent}%`;

        // Add view range labels
        const container_parent = container.parentElement;
        const rangeLabel = container_parent.querySelector('.view-range-label');
        if (rangeLabel) {
            rangeLabel.textContent = `View range: ${formatPercent(viewMin)} - ${formatPercent(viewMax)}`;
        }

        // Update labels with formatted values
        const lowLabel = document.getElementById(`${containerId}-low`);
        const highLabel = document.getElementById(`${containerId}-high`);

        if (lowLabel && highLabel) {
            lowLabel.textContent = formatPercent(low);
            highLabel.textContent = formatPercent(high);
            // Position labels relative to the colored bar
            lowLabel.style.left = `${lowPercent}%`;
            highLabel.style.left = `${highPercent}%`;
        }
    }

    // Base variant CI
    updateCIVisualization(
        'base-ci',
        challenge.simulation.confidenceIntervalBase[0],
        challenge.simulation.confidenceIntervalBase[1],
        challenge.simulation.actualBaseConversionRate,
        'blue'
    );

    // Test variant CI
    updateCIVisualization(
        'variant-ci',
        challenge.simulation.confidenceIntervalVariant[0],
        challenge.simulation.confidenceIntervalVariant[1],
        challenge.simulation.variantConversionRate,
        'green'
    );

    // Difference CI
    const diffMean = challenge.simulation.variantConversionRate - challenge.simulation.actualBaseConversionRate;
    updateCIVisualization(
        'diff-ci',
        challenge.simulation.confidenceIntervalDifference[0],
        challenge.simulation.confidenceIntervalDifference[1],
        diffMean,
        'purple'
    );
}

function renderConversionChart(challenge) {
    const ctx = document.getElementById('conversion-chart');
    if (!ctx) {
        console.error('Conversion chart canvas not found');
        return;
    }

    // Clear any existing chart
    const existingChart = Chart.getChart(ctx);
    if (existingChart) {
        existingChart.destroy();
    }

    new Chart(ctx, {
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
                borderColor: 'rgb(34, 197, 94)',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                fill: true
            }]
        },
        options: {
            responsive: true,
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
}

// Make sure charts resize properly
window.addEventListener('resize', function() {
    const chart = Chart.getChart('conversion-chart');
    if (chart) chart.resize();
});