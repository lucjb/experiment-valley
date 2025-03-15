function showLoading(chartId) {
    document.getElementById(`${chartId}-loading`).classList.remove('hidden');
}

function hideLoading(chartId) {
    document.getElementById(`${chartId}-loading`).classList.add('hidden');
}

function initializeCharts(challenge) {
    try {
        updateConfidenceIntervals(challenge);
        renderChart(challenge);
    } catch (error) {
        console.error('Error initializing visualizations:', error);
    }
}

function formatPercent(value) {
    // Convert to percentage and round to 2 decimal places
    const percentage = value * 100;
    // If it's a whole number, don't show decimals
    if (Math.round(percentage) === percentage) {
        return Math.round(percentage) + '%';
    }
    // Otherwise, show up to 2 decimal places, but trim trailing zeros
    return percentage.toFixed(2).replace(/\.?0+$/, '') + '%';
}

function formatDecimal(value) {
    return value.toFixed(4);
}

function updateConfidenceIntervals(challenge) {
    // Helper functions
    //const formatPercent = (value) => (value * 100).toFixed(2) + '%';
    //const formatDecimal = (value) => value.toFixed(4);

    // Display p-value
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

    // Display difference in conversion rate
    const diffValue = challenge.simulation.variantConversionRate - challenge.simulation.actualBaseConversionRate;
    const differenceDisplay = document.getElementById('difference-display');
    const differenceCI = document.getElementById('difference-ci');
    if (differenceDisplay && differenceCI) {
        differenceDisplay.textContent = formatPercent(diffValue);
        differenceCI.textContent = `[${formatPercent(challenge.simulation.confidenceIntervalDifference[0])} to ${formatPercent(challenge.simulation.confidenceIntervalDifference[1])}]`;
    }

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

    // Helper function to convert actual values to view percentages
    const toViewPercent = (value) => ((value - conversionViewMin) / conversionViewRange) * 100;

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

        // Calculate positions within the view range
        const lowPercent = toViewPercent(low);
        const highPercent = toViewPercent(high);
        const meanPercent = toViewPercent(mean);

        // Update visual elements
        if (rangeBar) {
            rangeBar.style.left = `${lowPercent}%`;
            rangeBar.style.width = `${highPercent - lowPercent}%`;
        }

        if (marker) {
            marker.style.left = `${meanPercent}%`;
        }

        // Update labels
        if (lowLabel) {
            lowLabel.textContent = formatPercent(low);
            lowLabel.style.left = `${lowPercent}%`;
        }

        if (pointLabel) {
            pointLabel.textContent = formatPercent(mean);
            pointLabel.style.left = `${meanPercent}%`;
        }

        if (highLabel) {
            highLabel.textContent = formatPercent(high);
            highLabel.style.left = `${highPercent}%`;
        }

        // Add or update view range bounds
        const minBound = container.querySelector('.view-min') || document.createElement('span');
        minBound.className = 'view-min absolute text-sm font-medium transform -translate-x-1/2 -translate-y-1/2 text-gray-400 top-1/2';
        minBound.style.left = '5%';  // Move slightly inside from the left edge
        minBound.textContent = formatPercent(conversionViewMin);
        if (!container.querySelector('.view-min')) {
            container.appendChild(minBound);
        }

        const maxBound = container.querySelector('.view-max') || document.createElement('span');
        maxBound.className = 'view-max absolute text-sm font-medium transform -translate-x-1/2 -translate-y-1/2 text-gray-400 top-1/2';
        maxBound.style.left = '95%';  // Move slightly inside from the right edge
        maxBound.textContent = formatPercent(conversionViewMax);
        if (!container.querySelector('.view-max')) {
            container.appendChild(maxBound);
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

    // For difference CI, calculate a separate view range
    const diffValues = [
        ...challenge.simulation.confidenceIntervalDifference,
        challenge.simulation.variantConversionRate - challenge.simulation.actualBaseConversionRate
    ];

    const minDiffValue = Math.min(...diffValues);
    const maxDiffValue = Math.max(...diffValues);
    const diffPadding = (maxDiffValue - minDiffValue) * 0.2;

    // Round to nice intervals
    const diffViewMin = Math.floor((minDiffValue - diffPadding) * 100) / 100;
    const diffViewMax = Math.ceil((maxDiffValue + diffPadding) * 100) / 100;

    const toDiffViewPercent = (value) => ((value - diffViewMin) / (diffViewMax - diffViewMin)) * 100;

    // Difference CI
    const diffMean = challenge.simulation.variantConversionRate - challenge.simulation.actualBaseConversionRate;
    const container = document.getElementById('diff-ci');

    if (container) {
        const rangeBar = container.querySelector('.bg-purple-200');
        const marker = container.querySelector('.bg-purple-600');
        const lowLabel = document.getElementById('diff-ci-low');
        const pointLabel = document.getElementById('diff-ci-point');
        const highLabel = document.getElementById('diff-ci-high');

        const lowPercent = toDiffViewPercent(challenge.simulation.confidenceIntervalDifference[0]);
        const highPercent = toDiffViewPercent(challenge.simulation.confidenceIntervalDifference[1]);
        const meanPercent = toDiffViewPercent(diffMean);

        if (rangeBar) {
            rangeBar.style.left = `${lowPercent}%`;
            rangeBar.style.width = `${highPercent - lowPercent}%`;
        }

        if (marker) {
            marker.style.left = `${meanPercent}%`;
        }

        if (lowLabel) {
            lowLabel.textContent = formatPercent(challenge.simulation.confidenceIntervalDifference[0]);
            lowLabel.style.left = `${lowPercent}%`;
        }

        if (pointLabel) {
            pointLabel.textContent = formatPercent(diffMean);
            pointLabel.style.left = `${meanPercent}%`;
        }

        if (highLabel) {
            highLabel.textContent = formatPercent(challenge.simulation.confidenceIntervalDifference[1]);
            highLabel.style.left = `${highPercent}%`;
        }

        // Add zero line for difference CI
        const zeroPercent = toDiffViewPercent(0);

        // Add or update zero line
        const zeroLine = container.querySelector('.zero-line') || document.createElement('div');
        zeroLine.className = 'zero-line absolute h-full w-1 bg-gray-400';
        zeroLine.style.left = `${zeroPercent}%`;
        if (!container.querySelector('.zero-line')) {
            container.appendChild(zeroLine);
        }
    }
}

function renderChart(challenge) {
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