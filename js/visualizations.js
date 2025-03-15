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
    // Helper function to format decimal as percentage
    const formatPercent = (value) => (value * 100).toFixed(2) + '%';
    const formatDecimal = (value) => value.toFixed(4); // Keep this for p-value

    // Find the range for conversion rate intervals
    const conversionValues = [
        ...challenge.simulation.confidenceIntervalBase,
        ...challenge.simulation.confidenceIntervalVariant,
        challenge.simulation.actualBaseConversionRate,
        challenge.simulation.variantConversionRate
    ];

    const minConversionValue = Math.min(...conversionValues);
    const maxConversionValue = Math.max(...conversionValues);

    // Round to nice intervals (multiples of 0.05)
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
    function updateCIVisualization(containerId, low, high, mean, color, viewType = 'conversion') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const toViewPercent = viewType === 'conversion' ? toConversionViewPercent : toDiffViewPercent;
        const viewMin = viewType === 'conversion' ? conversionViewMin : diffViewMin;
        const viewMax = viewType === 'conversion' ? conversionViewMax : diffViewMax;

        // Add view range bounds to the container parent's label
        const container_parent = container.parentElement;
        const rangeLabel = container_parent.querySelector('.view-range-label');
        if (rangeLabel) {
            rangeLabel.textContent = `View range: ${formatPercent(viewMin)} to ${formatPercent(viewMax)}`;
        }

        // Add bounds to the bar
        const minBound = container.querySelector('.min-bound') || document.createElement('div');
        minBound.className = 'min-bound absolute -bottom-6 transform -translate-x-1/2 text-sm font-medium text-gray-600';
        minBound.style.left = '0%';
        minBound.textContent = formatPercent(viewMin);
        if (!container.querySelector('.min-bound')) {
            container.appendChild(minBound);
        }

        const maxBound = container.querySelector('.max-bound') || document.createElement('div');
        maxBound.className = 'max-bound absolute -bottom-6 transform -translate-x-1/2 text-sm font-medium text-gray-600';
        maxBound.style.left = '100%';
        maxBound.textContent = formatPercent(viewMax);
        if (!container.querySelector('.max-bound')) {
            container.appendChild(maxBound);
        }

        const range = container.querySelector(`.bg-${color}-200`);
        const marker = container.querySelector(`.bg-${color}-600`);

        if (!range || !marker) return;

        // Calculate positions
        const lowPercent = toViewPercent(low);
        const highPercent = toViewPercent(high);
        const meanPercent = toViewPercent(mean);

        // Update range and marker positions
        range.style.left = `${lowPercent}%`;
        range.style.width = `${highPercent - lowPercent}%`;
        marker.style.left = `${meanPercent}%`;

        // Add or update mean value label
        const meanLabel = container.querySelector('.mean-value') || document.createElement('div');
        meanLabel.className = `mean-value absolute -top-6 transform -translate-x-1/2 text-sm font-bold text-${color}-600`;
        meanLabel.style.left = `${meanPercent}%`;
        meanLabel.textContent = `Point estimate: ${formatPercent(mean)}`;
        if (!container.querySelector('.mean-value')) {
            container.appendChild(meanLabel);
        }

        // Add low/high labels
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
        'blue',
        'conversion'
    );

    // Test variant CI
    updateCIVisualization(
        'variant-ci',
        challenge.simulation.confidenceIntervalVariant[0],
        challenge.simulation.confidenceIntervalVariant[1],
        challenge.simulation.variantConversionRate,
        'green',
        'conversion'
    );

    // Difference CI
    const diffMean = challenge.simulation.variantConversionRate - challenge.simulation.actualBaseConversionRate;
    updateCIVisualization(
        'diff-ci',
        challenge.simulation.confidenceIntervalDifference[0],
        challenge.simulation.confidenceIntervalDifference[1],
        diffMean,
        'purple',
        'difference'
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