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
        const alpha = challenge.experiment.alpha;  // Get the experiment's alpha value
        pValueElement.textContent = pValue.toFixed(4);
        if (pValue < alpha) {  // Compare against the experiment's alpha
            pValueElement.classList.add('text-green-600');
            pValueElement.classList.remove('text-blue-600');
        } else {
            pValueElement.classList.add('text-blue-600');
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

// Helper function to get confidence level from alpha
function getConfidenceLevel(alpha) {
    return Math.round((1 - alpha) * 100);
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

    // Calculate dynamic y-axis range based on the data
    function calculateYAxisRange(datasets) {
        let allValues = [];
        datasets.forEach(dataset => {
            if (!dataset.label.includes('CI')) {
                allValues = allValues.concat(dataset.data);
            }
        });
        const maxValue = Math.max(...allValues);
        // Set minimum to 20% below the lowest non-zero value, or 0 if all values are 0
        const nonZeroValues = allValues.filter(v => v > 0);
        const minValue = nonZeroValues.length > 0 ? Math.min(...nonZeroValues) : 0;
        return {
            min: Math.max(0, minValue - (minValue * 0.2)),
            max: maxValue + (maxValue * 0.1)
        };
    }

    // Get timeline data
    const timelineData = challenge.simulation.timeline;
    const timePoints = timelineData.timePoints;

    // Create labels based on time period
    const labels = timePoints.map(point => {
        const { type, startDay, endDay } = point.period;
        if (type === 'day') {
            return `Day ${startDay}`;
        } else if (type === 'week') {
            return `Week ${Math.ceil(startDay/7)}`;
        } else {
            return `Month ${Math.ceil(startDay/28)}`;
        }
    });

    // Create datasets based on the view type
    function createDatasets(viewType) {
        let datasets = viewType === 'daily' ? [
            {
                label: `Base ${timelineData.timePeriod}ly Rate`,
                data: timePoints.map(d => d.base.rate),
                borderColor: 'rgb(147, 51, 234)',
                backgroundColor: 'transparent',
                fill: false,
                tension: 0.4
            }, {
                label: 'Base CI Lower',
                data: timePoints.map(d => d.base.rateCI[0]),
                borderColor: 'transparent',
                backgroundColor: 'rgba(147, 51, 234, 0.1)',
                fill: '+1',
                tension: 0.4
            }, {
                label: 'Base CI Upper',
                data: timePoints.map(d => d.base.rateCI[1]),
                borderColor: 'transparent',
                fill: false,
                tension: 0.4
            }, {
                label: `Test ${timelineData.timePeriod}ly Rate`,
                data: timePoints.map(d => d.variant.rate),
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'transparent',
                fill: false,
                tension: 0.4
            }, {
                label: 'Test CI Lower',
                data: timePoints.map(d => d.variant.rateCI[0]),
                borderColor: 'transparent',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: '+1',
                tension: 0.4
            }, {
                label: 'Test CI Upper',
                data: timePoints.map(d => d.variant.rateCI[1]),
                borderColor: 'transparent',
                fill: false,
                tension: 0.4
            }
        ] : [
            {
                label: 'Base Cumulative Rate',
                data: timePoints.map(d => d.base.cumulativeRate),
                borderColor: 'rgb(107, 11, 194)',
                backgroundColor: 'transparent',
                borderDash: [5, 5],
                fill: false,
                tension: 0.4
            }, {
                label: 'Base CI Lower',
                data: timePoints.map(d => d.base.cumulativeRateCI[0]),
                borderColor: 'transparent',
                backgroundColor: 'rgba(107, 11, 194, 0.1)',
                fill: '+1',
                tension: 0.4
            }, {
                label: 'Base CI Upper',
                data: timePoints.map(d => d.base.cumulativeRateCI[1]),
                borderColor: 'transparent',
                fill: false,
                tension: 0.4
            }, {
                label: 'Test Cumulative Rate',
                data: timePoints.map(d => d.variant.cumulativeRate),
                borderColor: 'rgb(19, 90, 206)',
                backgroundColor: 'transparent',
                borderDash: [5, 5],
                fill: false,
                tension: 0.4
            }, {
                label: 'Test CI Lower',
                data: timePoints.map(d => d.variant.cumulativeRateCI[0]),
                borderColor: 'transparent',
                backgroundColor: 'rgba(19, 90, 206, 0.1)',
                fill: '+1',
                tension: 0.4
            }, {
                label: 'Test CI Upper',
                data: timePoints.map(d => d.variant.cumulativeRateCI[1]),
                borderColor: 'transparent',
                fill: false,
                tension: 0.4
            }
        ];

        // Calculate y-axis range based on the datasets
        const yAxisRange = calculateYAxisRange(datasets);
        datasets.yAxisRange = yAxisRange;

        return datasets;
    }

    let chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: createDatasets('daily')
        },
        options: {
            responsive: true,
            plugins: {
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x',
                        modifierKey: 'ctrl',
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                            modifierKey: 'ctrl',
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x',
                    },
                    onZoomComplete: function() {
                        resetZoomButton.style.display = 'block';
                    },
                    onResetZoom: function() {
                        resetZoomButton.style.display = 'none';
                    }
                },
                title: {
                    display: true,
                    text: `${timelineData.timePeriod.charAt(0).toUpperCase() + timelineData.timePeriod.slice(1)}ly Conversion Rates`
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
                            const timePoint = timePoints[context.dataIndex];
                            const dataPoint = context.dataset.label.toLowerCase().includes('base') ? 
                                timePoint.base : timePoint.variant;
                            const isCumulative = context.dataset.label.toLowerCase().includes('cumulative');

                            const visitors = isCumulative ? dataPoint.cumulativeVisitors : dataPoint.visitors;
                            const conversions = isCumulative ? dataPoint.cumulativeConversions : dataPoint.conversions;
                            const rate = isCumulative ? dataPoint.cumulativeRate : dataPoint.rate;
                            const ci = isCumulative ? dataPoint.cumulativeRateCI : dataPoint.rateCI;

                            const periodInfo = `${timelineData.timePeriod.charAt(0).toUpperCase() + timelineData.timePeriod.slice(1)} ${timePoint.period.startDay}${timePoint.period.endDay !== timePoint.period.startDay ? `-${timePoint.period.endDay}` : ''}`;
                            const confidenceLevel = getConfidenceLevel(challenge.experiment.alpha);

                            return [
                                `${context.dataset.label}: ${formatPercent(rate)}`,
                                `${confidenceLevel}% CI: [${formatPercent(ci[0])}, ${formatPercent(ci[1])}]`,
                                `Visitors: ${visitors.toLocaleString()}`,
                                `Conversions: ${conversions.toLocaleString()}`,
                                periodInfo
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
    const chartContainer = document.getElementById('conversion-chart').parentElement;
    const resetZoomButton = document.createElement('button');
    resetZoomButton.className = 'mt-2 px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm';
    resetZoomButton.textContent = 'Reset Zoom';
    resetZoomButton.style.display = 'none';
    chartContainer.appendChild(resetZoomButton);

    resetZoomButton.addEventListener('click', () => {
        chart.resetZoom();
    });


    // Update first option text based on time period
    const viewToggle = document.getElementById('chart-view-toggle');
    if (viewToggle) {
        viewToggle.options[0].text = `${timelineData.timePeriod.charAt(0).toUpperCase() + timelineData.timePeriod.slice(1)}ly View`;

        // Add event listener for the toggle
        viewToggle.addEventListener('change', function(e) {
            const viewType = e.target.value;
            const datasets = createDatasets(viewType);
            chart.data.datasets = datasets;
            chart.options.plugins.title.text = viewType === 'daily' ? 
                `${timelineData.timePeriod.charAt(0).toUpperCase() + timelineData.timePeriod.slice(1)}ly Conversion Rates` : 
                'Cumulative Conversion Rates';
            chart.options.scales.y.min = datasets.yAxisRange.min;
            chart.options.scales.y.max = datasets.yAxisRange.max;
            chart.update();
        });
    }

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

    // Get timeline data
    const timelineData = challenge.simulation.timeline;
    const timePoints = timelineData.timePoints;

    // Create labels based on time period
    const labels = timePoints.map(point => {
        const { type, startDay, endDay } = point.period;
        if (type === 'day') {
            return `Day ${startDay}`;
        } else if (type === 'week') {
            return `Week ${Math.ceil(startDay/7)}`;
        } else {
            return `Month ${Math.ceil(startDay/28)}`;
        }
    });

    // Create datasets based on the view type
    function createDatasets(viewType) {
        let datasets = viewType === 'daily' ? [
            {
                label: 'Base Visitors',
                data: timePoints.map(d => d.base.visitors),
                borderColor: 'rgb(147, 51, 234)',
                backgroundColor: 'rgba(147, 51, 234, 0.1)',
                fill: true
            },
            {
                label: 'Test Visitors',
                data: timePoints.map(d => d.variant.visitors),
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true
            }
        ] : [
            {
                label: 'Base Cumulative Visitors',
                data: timePoints.map(d => d.base.cumulativeVisitors),
                borderColor: 'rgb(107, 11, 194)',
                backgroundColor: 'rgba(107, 11, 194, 0.1)',
                fill: true,
                borderDash: [5, 5]
            },
            {
                label: 'Test Cumulative Visitors',
                data: timePoints.map(d => d.variant.cumulativeVisitors),
                borderColor: 'rgb(19, 90, 206)',
                backgroundColor: 'rgba(19, 90, 206, 0.1)',
                fill: true,
                borderDash: [5, 5]
            }
        ];

        return datasets;
    }

    let chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: createDatasets('daily')
        },
        options: {
            responsive: true,
            plugins: {
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x',
                        modifierKey: 'ctrl',
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                            modifierKey: 'ctrl',
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x',
                    },
                    onZoomComplete: function() {
                        resetZoomButton.style.display = 'block';
                    },
                    onResetZoom: function() {
                        resetZoomButton.style.display = 'none';
                    }
                },
                title: {
                    display: true,
                    text: `${timelineData.timePeriod.charAt(0).toUpperCase() + timelineData.timePeriod.slice(1)}ly Visitors`
                },
                tooltip: {
                    mode: 'point',
                    intersect: true,
                    position: 'nearest',
                    callbacks: {
                        label: function(context) {
                            const timePoint = timePoints[context.dataIndex];
                            const value = context.parsed.y;
                            const periodInfo = `${timelineData.timePeriod.charAt(0).toUpperCase() + timelineData.timePeriod.slice(1)} ${timePoint.period.startDay}${timePoint.period.endDay !== timePoint.period.startDay ? `-${timePoint.period.endDay}` : ''}`;
                            return [
                                `${context.dataset.label}: ${value.toLocaleString()}`,
                                periodInfo
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
    resetZoomButton.className = 'mt-2 px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm';
    resetZoomButton.textContent = 'Reset Zoom';
    resetZoomButton.style.display = 'none';
    chartContainer.appendChild(resetZoomButton);

    resetZoomButton.addEventListener('click', () => {
        chart.resetZoom();
    });

    // Update view toggle with correct period type
    const viewToggle = document.getElementById('visitors-view-toggle');
    if (viewToggle) {
        // Update first option based on time period
        const periodOption = viewToggle.options[0];
        periodOption.text = `${timelineData.timePeriod.charAt(0).toUpperCase() + timelineData.timePeriod.slice(1)}ly View`;

        // Add event listener for the toggle
        viewToggle.addEventListener('change', function(e) {
            const viewType = e.target.value;
            const datasets = createDatasets(viewType);
            chart.data.datasets = datasets;
            chart.options.plugins.title.text = viewType === 'daily' ? 
                `${timelineData.timePeriod.charAt(0).toUpperCase() + timelineData.timePeriod.slice(1)}ly Visitors` : 
                'Cumulative Visitors';
            chart.update();
        });
    }

    return chart;
}

function calculateDifferenceCI(variant, base, z) {
    // Guard against invalid inputs
    if (!variant || !base || variant.visitors === 0 || base.visitors === 0) {
        return [0, 0];
    }

    const diffRate = variant.rate - base.rate;
    const variantStdErr = Math.sqrt((variant.rate * (1 - variant.rate)) / variant.visitors);
    const baseStdErr = Math.sqrt((base.rate * (1 - base.rate)) / base.visitors);
    const combinedStdErr = Math.sqrt(variantStdErr * variantStdErr + baseStdErr * baseStdErr);

    return [
        diffRate - z * combinedStdErr,
        diffRate + z * combinedStdErr
    ];
}

function calculateCumulativeDifferenceCI(variant, base, z) {
    // Guard against invalid inputs
    if (!variant || !base || variant.cumulativeVisitors === 0 || base.cumulativeVisitors === 0) {
        return [0, 0];
    }

    const diffRate = variant.cumulativeRate - base.cumulativeRate;
    const variantStdErr = Math.sqrt((variant.cumulativeRate * (1 - variant.cumulativeRate)) / variant.cumulativeVisitors);
    const baseStdErr = Math.sqrt((base.cumulativeRate * (1 - base.cumulativeRate)) / base.cumulativeVisitors);
    const combinedStdErr = Math.sqrt(variantStdErr * variantStdErr + baseStdErr * baseStdErr);

    return [
        diffRate - z * combinedStdErr,
        diffRate + z * combinedStdErr
    ];
}

function renderDifferenceChart(challenge) {
    const ctx = document.getElementById('difference-chart');
    if (!ctx) {
        console.error('Difference chart canvas not found');
        return;
    }

    // Clear any existing chart
    const existingChart = Chart.getChart(ctx);
    if (existingChart) {
        existingChart.destroy();
    }

    // Get timeline data
    const timelineData = challenge.simulation.timeline;
    const timePoints = timelineData.timePoints;
    const z = challenge.experiment.zScore;

    // Create labels based on time period
    const labels = timePoints.map(point => {
        const { type, startDay, endDay } = point.period;
        if (type === 'day') {
            return `Day ${startDay}`;
        } else if (type === 'week') {
            return `Week ${Math.ceil(startDay/7)}`;
        } else {
            return `Month ${Math.ceil(startDay/28)}`;
        }
    });

    // Create datasets based on the view type
    function createDatasets(viewType) {
        let datasets = viewType === 'daily' ? [
            {
                label: `${timelineData.timePeriod}ly Difference`,
                data: timePoints.map(d => d.variant.rate - d.base.rate),
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'transparent',
                fill: false,
                tension: 0.4
            },
            {
                label: 'Difference CI Lower',
                data: timePoints.map(d => calculateDifferenceCI(d.variant, d.base, z)[0]),
                borderColor: 'transparent',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: '+1',
                tension: 0.4
            },
            {
                label: 'Difference CI Upper',
                data: timePoints.map(d => calculateDifferenceCI(d.variant, d.base, z)[1]),
                borderColor: 'transparent',
                fill: false,
                tension: 0.4
            }
        ] : [
            {
                label: 'Cumulative Difference',
                data: timePoints.map(d => d.variant.cumulativeRate - d.base.cumulativeRate),
                borderColor: 'rgb(19, 90, 206)',
                backgroundColor: 'transparent',
                fill: false,
                borderDash: [5, 5],
                tension: 0.4
            },
            {
                label: 'Cumulative Difference CI Lower',
                data: timePoints.map(d => calculateCumulativeDifferenceCI(d.variant, d.base, z)[0]),
                borderColor: 'transparent',
                backgroundColor: 'rgba(19, 90, 206, 0.1)',
                fill: '+1',
                tension: 0.4
            },
            {
                label: 'Cumulative Difference CI Upper',
                data: timePoints.map(d => calculateCumulativeDifferenceCI(d.variant, d.base, z)[1]),
                borderColor: 'transparent',
                fill: false,
                tension: 0.4
            }
        ];

        return datasets;
    }

    let chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: createDatasets('daily')
        },
        options: {
            responsive: true,
            plugins: {
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x',
                        modifierKey: 'ctrl',
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                            modifierKey: 'ctrl',
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x',
                    },
                    onZoomComplete: function() {
                        resetZoomButton.style.display = 'block';
                    },
                    onResetZoom: function() {
                        resetZoomButton.style.display = 'none';
                    }
                },
                title: {
                    display: true,
                    text: `${timelineData.timePeriod.charAt(0).toUpperCase() + timelineData.timePeriod.slice(1)}ly Conversion Rate Difference`
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
                            const timePoint = timePoints[context.dataIndex];
                            const value = context.parsed.y;
                            const isCumulative = context.dataset.label.toLowerCase().includes('cumulative');

                            let cis;
                            if (isCumulative) {
                                cis = calculateCumulativeDifferenceCI(timePoint.variant, timePoint.base, z);
                            } else {
                                cis = calculateDifferenceCI(timePoint.variant, timePoint.base, z);
                            }

                            const periodInfo = `${timelineData.timePeriod.charAt(0).toUpperCase() + timelineData.timePeriod.slice(1)} ${timePoint.period.startDay}${timePoint.period.endDay !== timePoint.period.startDay ? `-${timePoint.period.endDay}` : ''}`;
                            const confidenceLevel = getConfidenceLevel(challenge.experiment.alpha);

                            return [
                                `${context.dataset.label}: ${formatPercent(value)}`,
                                `${confidenceLevel}% CI: [${formatPercent(cis[0])}, ${formatPercent(cis[1])}]`,
                                periodInfo
                            ];
                        }
                    }
                }
            },
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Conversion Rate Difference'
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
    resetZoomButton.className = 'mt-2 px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm';
    resetZoomButton.textContent = 'Reset Zoom';
    resetZoomButton.style.display = 'none';
    chartContainer.appendChild(resetZoomButton);

    resetZoomButton.addEventListener('click', () => {
        chart.resetZoom();
    });

    // Update view toggle with correct period type
    const viewToggle = document.getElementById('difference-view-toggle');
    if (viewToggle) {
        // Update first option based on time period
        const periodOption = viewToggle.options[0];
        periodOption.text = `${timelineData.timePeriod.charAt(0).toUpperCase() + timelineData.timePeriod.slice(1)}ly View`;

        // Add event listener for the toggle
        viewToggle.addEventListener('change', function(e) {
            const viewType = e.target.value;
            const datasets = createDatasets(viewType);
            chart.data.datasets = datasets;
            chart.options.plugins.title.text = viewType === 'daily' ? 
                `${timelineData.timePeriod.charAt(0).toUpperCase() + timelineData.timePeriod.slice(1)}ly Conversion Rate Difference` : 
                'Cumulative Conversion Rate Difference';
            chart.update();
        });
    }

    return chart;
}

function initializeCharts(challenge) {
    try {
        // Reset view toggle to 'daily' first
        const viewToggle = document.getElementById('chart-view-toggle');
        if (viewToggle) {
            viewToggle.value = 'daily';
        }

        updateConfidenceIntervals(challenge);
        renderChart(challenge);
        renderVisitorsChart(challenge);
        renderDifferenceChart(challenge);
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
    const differenceChart = Chart.getChart('difference-chart');
    if (differenceChart) differenceChart.resize();
});