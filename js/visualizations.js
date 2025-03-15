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

    // Display p-value
    const pValueElement = document.getElementById('p-value-display');
    if (pValueElement) {
        pValueElement.textContent = challenge.simulation.pValue.toFixed(4);
        // Color p-value based on significance
        if (challenge.simulation.pValue < 0.05) {
            pValueElement.classList.add('text-green-600');
            pValueElement.classList.remove('text-red-600');
        } else {
            pValueElement.classList.add('text-red-600');
            pValueElement.classList.remove('text-green-600');
        }
    }

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
        const meanLabel = container.querySelector('.mean-value');

        if (!range || !marker) {
            console.error(`Required elements not found in ${containerId}`);
            return;
        }

        // Calculate positions in view space
        const lowPercent = toViewPercent(low);
        const highPercent = toViewPercent(high);
        const meanPercent = toViewPercent(mean);

        // Update range and marker positions
        range.style.left = `${lowPercent}%`;
        range.style.width = `${highPercent - lowPercent}%`;
        marker.style.left = `${meanPercent}%`;

        // Add mean value label
        if (!meanLabel) {
            const label = document.createElement('div');
            label.className = 'mean-value absolute -top-6 transform -translate-x-1/2 text-sm font-medium';
            label.style.left = `${meanPercent}%`;
            label.style.color = `var(--${color}-600)`;
            label.textContent = `Mean: ${formatPercent(mean)}`;
            container.appendChild(label);
        } else {
            meanLabel.style.left = `${meanPercent}%`;
            meanLabel.textContent = `Mean: ${formatPercent(mean)}`;
        }

        // Add view range labels
        const container_parent = container.parentElement;
        const rangeLabel = container_parent.querySelector('.view-range-label');
        if (rangeLabel) {
            rangeLabel.textContent = `View range: ${formatPercent(viewMin)} - ${formatPercent(viewMax)}`;
        }

        // Update low/high labels
        const lowLabel = document.getElementById(`${containerId}-low`);
        const highLabel = document.getElementById(`${containerId}-high`);

        if (lowLabel && highLabel) {
            lowLabel.textContent = formatPercent(low);
            highLabel.textContent = formatPercent(high);
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

    // Add zero line marker for difference CI
    const diffContainer = document.getElementById('diff-ci');
    const zeroPercent = toViewPercent(0);
    const zeroLine = diffContainer.querySelector('.zero-line') || document.createElement('div');
    zeroLine.className = 'zero-line absolute h-full w-0.5 bg-gray-600';
    zeroLine.style.left = `${zeroPercent}%`;
    if (!diffContainer.querySelector('.zero-line')) {
        diffContainer.appendChild(zeroLine);
    }

    // Add zero label
    const zeroLabel = diffContainer.querySelector('.zero-label') || document.createElement('div');
    zeroLabel.className = 'zero-label absolute -bottom-6 transform -translate-x-1/2 text-sm font-medium text-gray-600';
    zeroLabel.style.left = `${zeroPercent}%`;
    zeroLabel.textContent = '0';
    if (!diffContainer.querySelector('.zero-label')) {
        diffContainer.appendChild(zeroLabel);
    }
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