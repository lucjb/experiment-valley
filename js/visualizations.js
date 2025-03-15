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

function formatPercent(value) {
    return (value * 100).toFixed(2) + '%';
}

function formatDecimal(value) {
    return value.toFixed(4);
}

function updateConfidenceIntervals(challenge) {
    // Find the range for conversion rate intervals
    const conversionValues = [
        ...challenge.simulation.confidenceIntervalBase,
        ...challenge.simulation.confidenceIntervalVariant,
        challenge.simulation.actualBaseConversionRate,
        challenge.simulation.variantConversionRate
    ];

    const minConversionValue = Math.min(...conversionValues);
    const maxConversionValue = Math.max(...conversionValues);

    // Round to nice intervals (multiples of 0.05 or 5%)
    const conversionViewMin = Math.floor(minConversionValue * 20) / 20;
    const conversionViewMax = Math.ceil(maxConversionValue * 20) / 20;
    const conversionViewRange = conversionViewMax - conversionViewMin;

    // Separate range for difference CI
    const diffValues = [
        ...challenge.simulation.confidenceIntervalDifference,
        challenge.simulation.variantConversionRate - challenge.simulation.actualBaseConversionRate
    ];

    const minDiffValue = Math.min(...diffValues);
    const maxDiffValue = Math.max(...diffValues);
    const diffPadding = (maxDiffValue - minDiffValue) * 0.2;

    // Round difference view range to nice intervals
    const diffViewMin = Math.floor((minDiffValue - diffPadding) * 100) / 100;
    const diffViewMax = Math.ceil((maxDiffValue + diffPadding) * 100) / 100;
    const diffViewRange = diffViewMax - diffViewMin;

    // Display p-value (keep as decimal)
    const pValueElement = document.getElementById('p-value-display');
    if (pValueElement) {
        pValueElement.textContent = formatDecimal(challenge.simulation.pValue);
        if (challenge.simulation.pValue < 0.05) {
            pValueElement.classList.add('text-green-600');
            pValueElement.classList.remove('text-red-600');
        } else {
            pValueElement.classList.add('text-red-600');
            pValueElement.classList.remove('text-green-600');
        }
    }

    // Display difference in conversion rate (as percentage)
    const diffValue = challenge.simulation.variantConversionRate - challenge.simulation.actualBaseConversionRate;
    const differenceDisplay = document.getElementById('difference-display');
    const differenceCI = document.getElementById('difference-ci');
    if (differenceDisplay && differenceCI) {
        differenceDisplay.textContent = formatPercent(diffValue);
        differenceCI.textContent = `[${formatPercent(challenge.simulation.confidenceIntervalDifference[0])} to ${formatPercent(challenge.simulation.confidenceIntervalDifference[1])}]`;
    }

    // Helper functions to convert actual values to view percentages
    const toConversionViewPercent = (value) => ((value - conversionViewMin) / conversionViewRange) * 100;
    const toDiffViewPercent = (value) => ((value - diffViewMin) / diffViewRange) * 100;

    // Helper function to set CI visualization
    function updateCIVisualization(containerId, low, high, mean, color) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Get elements
        const rangeBar = container.querySelector(`.bg-${color}-200`);
        const marker = container.querySelector(`.bg-${color}-600`);
        const lowLabel = document.getElementById(`${containerId}-low`);
        const pointLabel = document.getElementById(`${containerId}-point`);
        const highLabel = document.getElementById(`${containerId}-high`);

        // Calculate positions within CI bar (0-100%)
        const range = high - low;
        const meanPercent = ((mean - low) / range) * 100;

        // Update visual elements
        if (rangeBar) {
            rangeBar.style.left = '0%';
            rangeBar.style.width = '100%';
        }

        if (marker) {
            marker.style.left = `${meanPercent}%`;
        }

        // Update labels
        if (lowLabel) {
            lowLabel.textContent = formatPercent(low);
            lowLabel.style.left = '0%';
        }

        if (pointLabel) {
            pointLabel.textContent = formatPercent(mean);
            pointLabel.style.left = `${meanPercent}%`;
        }

        if (highLabel) {
            highLabel.textContent = formatPercent(high);
            highLabel.style.left = '100%';
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
    if (diffContainer) {
        const zeroPercent = toDiffViewPercent(0);

        // Add or update zero line
        const zeroLine = diffContainer.querySelector('.zero-line') || document.createElement('div');
        zeroLine.className = 'zero-line absolute h-full w-1 bg-gray-400';
        zeroLine.style.left = `${zeroPercent}%`;
        if (!diffContainer.querySelector('.zero-line')) {
            diffContainer.appendChild(zeroLine);
        }

        // Add or update zero label
        const zeroLabel = diffContainer.querySelector('.zero-label') || document.createElement('div');
        zeroLabel.className = 'zero-label absolute -top-6 transform -translate-x-1/2 text-sm font-medium text-gray-600';
        zeroLabel.style.left = `${zeroPercent}%`;
        zeroLabel.textContent = '0%';
        if (!diffContainer.querySelector('.zero-label')) {
            diffContainer.appendChild(zeroLabel);
        }
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
                            return `${context.dataset.label}: ${formatPercent(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Conversion Rate'
                    },
                    ticks: {
                        callback: function(value) {
                            return formatPercent(value);
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