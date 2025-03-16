const computeConfidenceInterval = window.computeConfidenceInterval;

function showLoading(chartId) {
    document.getElementById(`${chartId}-loading`).classList.remove('hidden');
}

function hideLoading(chartId) {
    document.getElementById(`${chartId}-loading`).classList.add('hidden');
}

function formatPercent(value) {
    const percentage = value * 100;
    if (Math.round(percentage) === percentage) {
        return Math.round(percentage) + '%';
    }
    return percentage.toFixed(2).replace(/\.?0+$/, '') + '%';
}

function formatDecimal(value) {
    return value.toFixed(4);
}

function updateConfidenceIntervals(challenge) {
    // Display p-value
    const pValueElement = document.getElementById('p-value-display');
    if (pValueElement) {
        const pValue = challenge.simulation.pValue;
        pValueElement.textContent = pValue.toFixed(4);
        if (pValue < 0.05) {
            pValueElement.classList.add('text-green-600');
            pValueElement.classList.remove('text-red-600');
        } else {
            pValueElement.classList.add('text-red-600');
            pValueElement.classList.remove('text-green-600');
        }
    }

    // Calculate the difference in conversion rate
    const diffValue = challenge.simulation.variantConversionRate - challenge.simulation.actualBaseConversionRate;

    // Display difference in conversion rate
    const differenceDisplay = document.getElementById('difference-display');
    if (differenceDisplay) {
        differenceDisplay.textContent = formatPercent(diffValue);
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
    const conversionViewRange = maxConversionValue - minConversionValue;
    const viewPadding = conversionViewRange * 0.2;

    // Round to nice intervals
    const conversionViewMin = Math.floor((minConversionValue - viewPadding) * 100) / 100;
    const conversionViewMax = Math.ceil((maxConversionValue + viewPadding) * 100) / 100;

    // Helper function to convert actual values to view percentages
    const toViewPercent = (value) => ((value - conversionViewMin) / (conversionViewMax - conversionViewMin)) * 100;

    // Determine result type based on CI difference
    const lowDiff = challenge.simulation.confidenceIntervalDifference[0];
    const highDiff = challenge.simulation.confidenceIntervalDifference[1];
    let resultType;
    if (lowDiff > 0) {
        resultType = 'positive';
    } else if (highDiff < 0) {
        resultType = 'negative';
    } else {
        resultType = 'inconclusive';
    }

    // Color mappings based on result type
    const variantColors = {
        positive: {
            bar: 'bg-green-200',
            marker: 'bg-green-600',
            text: 'text-green-900'
        },
        negative: {
            bar: 'bg-red-200',
            marker: 'bg-red-600',
            text: 'text-red-900'
        },
        inconclusive: {
            bar: 'bg-blue-200',
            marker: 'bg-blue-600',
            text: 'text-blue-900'
        }
    };

    // Helper function to set CI visualization
    function updateCIVisualization(containerId, low, high, mean, colorSet, showBounds = true) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Get elements
        const rangeBar = container.querySelector('div:nth-child(1)');
        const marker = container.querySelector('div:nth-child(2)');
        const lowLabel = document.getElementById(`${containerId}-low`);
        const highLabel = document.getElementById(`${containerId}-high`);

        // Calculate positions
        const lowPercent = toViewPercent(low);
        const highPercent = toViewPercent(high);
        const meanPercent = toViewPercent(mean);

        // Update visual elements
        if (rangeBar) {
            rangeBar.className = `absolute h-full ${colorSet.bar} rounded-md`;
            rangeBar.style.left = `${lowPercent}%`;
            rangeBar.style.width = `${highPercent - lowPercent}%`;
        }

        if (marker) {
            marker.className = `absolute w-0.5 h-full ${colorSet.marker} rounded-sm`;
            marker.style.left = `${meanPercent}%`;
        }

        // Update labels
        if (lowLabel) {
            lowLabel.className = `absolute text-xs font-medium transform -translate-x-1/2 ${colorSet.text} top-1/2 -translate-y-1/2 drop-shadow-sm`;
            lowLabel.textContent = formatPercent(low);
            lowLabel.style.left = `${lowPercent}%`;
        }

        if (highLabel) {
            highLabel.className = `absolute text-xs font-medium transform -translate-x-1/2 ${colorSet.text} top-1/2 -translate-y-1/2 drop-shadow-sm`;
            highLabel.textContent = formatPercent(high);
            highLabel.style.left = `${highPercent}%`;
        }

        // Add view range bounds if needed
        if (showBounds) {
            const viewBounds = {
                min: container.querySelector('.view-min') || document.createElement('span'),
                max: container.querySelector('.view-max') || document.createElement('span')
            };

            for (const [key, element] of Object.entries(viewBounds)) {
                const position = key === 'min' ? '2%' : '98%';
                const value = key === 'min' ? conversionViewMin : conversionViewMax;

                element.className = 'absolute text-xs font-medium transform -translate-x-1/2 -translate-y-1/2 text-gray-400 top-1/2';
                element.style.left = position;
                element.textContent = formatPercent(value);

                if (!container.querySelector(`.view-${key}`)) {
                    element.classList.add(`view-${key}`);
                    container.appendChild(element);
                }
            }
        }
    }

    // Update base CI (always purple)
    updateCIVisualization(
        'base-ci',
        challenge.simulation.confidenceIntervalBase[0],
        challenge.simulation.confidenceIntervalBase[1],
        challenge.simulation.actualBaseConversionRate,
        {
            bar: 'bg-purple-200',
            marker: 'bg-purple-600',
            text: 'text-purple-900'
        },
        true
    );

    // Update variant CI with result-based colors
    updateCIVisualization(
        'variant-ci',
        challenge.simulation.confidenceIntervalVariant[0],
        challenge.simulation.confidenceIntervalVariant[1],
        challenge.simulation.variantConversionRate,
        variantColors[resultType],
        true
    );

    // For difference CI, calculate a view range centered around zero
    const diffValues = [
        ...challenge.simulation.confidenceIntervalDifference,
        diffValue
    ];
    const maxAbsDiff = Math.max(Math.abs(Math.min(...diffValues)), Math.abs(Math.max(...diffValues)));
    const diffViewMin = -maxAbsDiff * 1.2;  // Add 20% padding
    const diffViewMax = maxAbsDiff * 1.2;   // Add 20% padding
    const toDiffViewPercent = (value) => ((value - diffViewMin) / (diffViewMax - diffViewMin)) * 100;

    // Update difference CI
    const diffContainer = document.getElementById('diff-ci');
    if (diffContainer) {
        const diffCIBar = document.getElementById('diff-ci-bar');
        const diffCIMarker = document.getElementById('diff-ci-marker');
        const lowLabel = document.getElementById('diff-ci-low');
        const highLabel = document.getElementById('diff-ci-high');

        // Calculate positions
        const lowPercent = toDiffViewPercent(lowDiff);
        const highPercent = toDiffViewPercent(highDiff);
        const meanPercent = toDiffViewPercent(diffValue);
        const zeroPercent = toDiffViewPercent(0);

        // Apply the same color scheme as variant
        const colors = variantColors[resultType];

        // Update elements
        if (diffCIBar) {
            diffCIBar.className = `absolute h-full ${colors.bar} rounded-md`;
            diffCIBar.style.left = `${lowPercent}%`;
            diffCIBar.style.width = `${highPercent - lowPercent}%`;
        }

        if (diffCIMarker) {
            diffCIMarker.className = `absolute w-0.5 h-full ${colors.marker} rounded-sm`;
            diffCIMarker.style.left = `${meanPercent}%`;
        }

        if (lowLabel) {
            lowLabel.className = `absolute text-xs font-medium transform -translate-x-1/2 ${colors.text} top-1/2 -translate-y-1/2 drop-shadow-sm`;
            lowLabel.textContent = formatPercent(lowDiff);
            lowLabel.style.left = `${lowPercent}%`;
        }

        if (highLabel) {
            highLabel.className = `absolute text-xs font-medium transform -translate-x-1/2 ${colors.text} top-1/2 -translate-y-1/2 drop-shadow-sm`;
            highLabel.textContent = formatPercent(highDiff);
            highLabel.style.left = `${highPercent}%`;
        }

        // Update zero line
        const zeroLine = diffContainer.querySelector('.zero-line') || document.createElement('div');
        zeroLine.className = 'zero-line absolute h-full w-px bg-gray-400';
        zeroLine.style.left = `${zeroPercent}%`;
        if (!diffContainer.querySelector('.zero-line')) {
            diffContainer.appendChild(zeroLine);
        }

        // Update zero label
        const zeroLabel = diffContainer.querySelector('.zero-label') || document.createElement('span');
        zeroLabel.className = 'zero-label absolute text-xs font-medium transform -translate-x-1/2 text-gray-400 top-1/2 -translate-y-1/2';
        zeroLabel.style.left = `${zeroPercent}%`;
        zeroLabel.textContent = '0%';
        if (!diffContainer.querySelector('.zero-label')) {
            diffContainer.appendChild(zeroLabel);
        }
    }
    // Update uplift CI
    const container = document.getElementById('uplift-ci');
    if (container) {
        const upliftValue = challenge.simulation.uplift;
        const [lowUplift, highUplift] = challenge.simulation.upliftConfidenceInterval;

        // Determine color based on significance
        const colors = resultType === 'positive' ? {
            bar: 'bg-green-200',
            marker: 'bg-green-600',
            text: 'text-green-900'
        } : resultType === 'negative' ? {
            bar: 'bg-red-200',
            marker: 'bg-red-600',
            text: 'text-red-900'
        } : {
            bar: 'bg-blue-200',
            marker: 'bg-blue-600',
            text: 'text-blue-900'
        };

        const upliftBar = document.getElementById('uplift-ci-bar');
        const upliftMarker = document.getElementById('uplift-ci-marker');
        const lowLabel = document.getElementById('uplift-ci-low');
        const highLabel = document.getElementById('uplift-ci-high');

        // Calculate relative positions
        const maxAbsUplift = Math.max(Math.abs(lowUplift), Math.abs(highUplift), Math.abs(upliftValue)) * 1.2;
        const viewMin = -maxAbsUplift;
        const viewMax = maxAbsUplift;
        const toViewPercent = (value) => ((value - viewMin) / (viewMax - viewMin)) * 100;

        // Update visual elements
        if (upliftBar) {
            upliftBar.className = `absolute h-full ${colors.bar} rounded-md`;
            upliftBar.style.left = `${toViewPercent(lowUplift)}%`;
            upliftBar.style.width = `${toViewPercent(highUplift) - toViewPercent(lowUplift)}%`;
        }

        if (upliftMarker) {
            upliftMarker.className = `absolute w-0.5 h-full ${colors.marker} rounded-sm`;
            upliftMarker.style.left = `${toViewPercent(upliftValue)}%`;
        }

        if (lowLabel) {
            lowLabel.className = `absolute text-xs font-medium transform -translate-x-1/2 ${colors.text} top-1/2 -translate-y-1/2 drop-shadow-sm`;
            lowLabel.textContent = formatPercent(lowUplift);
            lowLabel.style.left = `${toViewPercent(lowUplift)}%`;
        }

        if (highLabel) {
            highLabel.className = `absolute text-xs font-medium transform -translate-x-1/2 ${colors.text} top-1/2 -translate-y-1/2 drop-shadow-sm`;
            highLabel.textContent = formatPercent(highUplift);
            highLabel.style.left = `${toViewPercent(highUplift)}%`;
        }

        // Add zero line
        const zeroLine = container.querySelector('.zero-line') || document.createElement('div');
        zeroLine.className = 'absolute h-full w-px bg-gray-400';
        zeroLine.style.left = `${toViewPercent(0)}%`;
        if (!container.querySelector('.zero-line')) {
            container.appendChild(zeroLine);
        }

        // Add zero label
        const zeroLabel = container.querySelector('.zero-label') || document.createElement('span');
        zeroLabel.className = 'zero-label absolute text-xs font-medium transform -translate-x-1/2 text-gray-400 top-1/2 -translate-y-1/2';
        zeroLabel.style.left = `${toViewPercent(0)}%`;
        zeroLabel.textContent = '0%';
        if (!container.querySelector('.zero-label')) {
            container.appendChild(zeroLabel);
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

    const datasets = [
        {
            label: 'Base Rate',
            data: challenge.simulation.timeline.data.map(d => d.base.rate),
            borderColor: 'rgb(147, 51, 234)',
            backgroundColor: 'transparent',
            fill: false,
            tension: 0.4,
            pointRadius: 2
        },
        {
            label: 'Base CI Lower',
            data: challenge.simulation.timeline.data.map(d => d.base.rateCI[0]),
            borderColor: 'transparent',
            backgroundColor: 'rgba(147, 51, 234, 0.1)',
            fill: '+1',
            tension: 0.4,
            pointRadius: 0
        },
        {
            label: 'Base CI Upper',
            data: challenge.simulation.timeline.data.map(d => d.base.rateCI[1]),
            borderColor: 'transparent',
            fill: false,
            tension: 0.4,
            pointRadius: 0
        },
        {
            label: 'Test Rate',
            data: challenge.simulation.timeline.data.map(d => d.variant.rate),
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'transparent',
            fill: false,
            tension: 0.4,
            pointRadius: 2
        },
        {
            label: 'Test CI Lower',
            data: challenge.simulation.timeline.data.map(d => d.variant.rateCI[0]),
            borderColor: 'transparent',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: '+1',
            tension: 0.4,
            pointRadius: 0
        },
        {
            label: 'Test CI Upper',
            data: challenge.simulation.timeline.data.map(d => d.variant.rateCI[1]),
            borderColor: 'transparent',
            fill: false,
            tension: 0.4,
            pointRadius: 0
        }
    ];

    let chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from(
                { length: challenge.simulation.timeline.data.length },
                (_, i) => `${challenge.simulation.timeline.periodName} ${i + 1}`
            ),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                zoom: {
                    limits: {
                        y: { min: 0 },
                    },
                    pan: {
                        enabled: true,
                        mode: 'xy',
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                        },
                        pinch: {
                            enabled: true
                        },
                        drag: {
                            enabled: true,
                            backgroundColor: 'rgba(127,127,127,0.2)'
                        },
                        mode: 'xy',
                    }
                },
                title: {
                    display: true,
                    text: `${challenge.simulation.timeline.periodName}ly Conversion Rates`
                },
                tooltip: {
                    mode: 'point',
                    intersect: true,
                    position: 'nearest',
                    filter: function(tooltipItem) {
                        return !tooltipItem.dataset.label.includes('CI');
                    },
                    callbacks: {
                        label: function(context) {
                            const data = challenge.simulation.timeline.data[context.dataIndex][
                                context.dataset.label.toLowerCase().includes('base') ? 'base' : 'variant'
                            ];
                            return [
                                `${context.dataset.label}: ${formatPercent(data.rate)}`,
                                `95% CI: [${formatPercent(data.rateCI[0])}, ${formatPercent(data.rateCI[1])}]`,
                                `Visitors: ${data.visitors.toLocaleString()}`,
                                `Conversions: ${data.conversions.toLocaleString()}`
                            ];
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

    // Add reset zoom button
    const chartContainer = ctx.parentElement;
    const resetZoomButton = document.createElement('button');
    resetZoomButton.className = 'mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium transition-colors';
    resetZoomButton.textContent = 'Reset Zoom';
    resetZoomButton.style.display = 'none';
    chartContainer.appendChild(resetZoomButton);

    resetZoomButton.addEventListener('click', () => {
        chart.resetZoom();
    });

    chart.options.plugins.zoom.zoom.onZoomComplete = function() {
        resetZoomButton.style.display = 'block';
    };

    chart.options.plugins.zoom.zoom.onResetZoom = function() {
        resetZoomButton.style.display = 'none';
    };

    return chart;
}

function renderVisitorsChart(challenge) {
    const ctx = document.getElementById('visitors-chart');
    if (!ctx) {
        console.error('Visitors chart canvas not found');
        return;
    }

    // Clear any existing chart
    const existingChart = Chart.getChart(ctx);
    if (existingChart) {
        existingChart.destroy();
    }

    // Create datasets
    const datasets = [
        {
            label: 'Base Visitors',
            data: challenge.simulation.timeline.data.map(d => d.base.visitors),
            borderColor: 'rgb(147, 51, 234)',
            backgroundColor: 'rgba(147, 51, 234, 0.1)',
            fill: true
        },
        {
            label: 'Test Visitors',
            data: challenge.simulation.timeline.data.map(d => d.variant.visitors),
            borderColor: 'rgb(59, 130, 246)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true
        }
    ];

    let chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from(
                { length: challenge.simulation.timeline.data.length },
                (_, i) => `${challenge.simulation.timeline.periodName} ${i + 1}`
            ),
            datasets: datasets
        },
        options: {
            responsive: true,
            plugins: {
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'xy',
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                        },
                        pinch: {
                            enabled: true
                        },
                        drag: {
                            enabled: true,
                            backgroundColor: 'rgba(127,127,127,0.2)'
                        },
                        mode: 'xy',
                    }
                },
                title: {
                    display: true,
                    text: `${challenge.simulation.timeline.periodName}ly Visitors`
                },
                tooltip: {
                    mode: 'point',
                    intersect: true,
                    position: 'nearest',
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.y;
                            return `${context.dataset.label}: ${value.toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Visitors'
                    },
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    }
                }
            }
        }
    });

    // Add reset zoom button
    const chartContainer = ctx.parentElement;
    const resetZoomButton = document.createElement('button');
    resetZoomButton.className = 'mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm font-medium transition-colors';
    resetZoomButton.textContent = 'Reset Zoom';
    resetZoomButton.style.display = 'none';
    chartContainer.appendChild(resetZoomButton);

    resetZoomButton.addEventListener('click', () => {
        chart.resetZoom();
    });

    chart.options.plugins.zoom.zoom.onZoomComplete = function() {
        resetZoomButton.style.display = 'block';
    };

    chart.options.plugins.zoom.zoom.onResetZoom = function() {
        resetZoomButton.style.display = 'none';
    };

    return chart;
}

function initializeCharts(challenge) {
    try {
        updateConfidenceIntervals(challenge);
        renderChart(challenge);
        renderVisitorsChart(challenge);
    } catch (error) {
        console.error('Error initializing visualizations:', error);
    }
}

// Make sure charts resize properly
window.addEventListener('resize', function() {
    const conversionChart = Chart.getChart('conversion-chart');
    if (conversionChart) conversionChart.resize();

    const visitorsChart = Chart.getChart('visitors-chart');
    if (visitorsChart) visitorsChart.resize();
});

// Make functions available globally
window.initializeCharts = initializeCharts;
window.updateConfidenceIntervals = updateConfidenceIntervals;