function showLoading(chartId) {
    document.getElementById(`${chartId}-loading`).classList.remove('hidden');
}

function hideLoading(chartId) {
    document.getElementById(`${chartId}-loading`).classList.add('hidden');
}

function calculateConfidenceLevel(alpha) {
    return ((1 - alpha) * 100).toFixed(0);
}

function formatPercent(value) {
    const percentage = value * 100;
    // Always show 2 decimal places for consistency with the table
    return percentage.toFixed(2) + '%';
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

function renderChart(challenge) {
    const ctx = document.getElementById('conversion-chart');
    if (!ctx) {
        console.error('Conversion chart canvas not found');
        return;
    }

    try {
        // Clear any existing chart
        const existingChart = Chart.getChart(ctx);
        if (existingChart) {
            existingChart.destroy();
        }

        // Get timeline data
        const timelineData = challenge.simulation.timeline;
        const timePoints = timelineData.timePoints;
        const totalDays = challenge.experiment.requiredRuntimeDays;
        const currentDays = challenge.simulation.timeline.currentRuntimeDays;

        // Generate complete timeline including future empty periods
        const completeTimeline = [...timePoints];
        if (currentDays < totalDays) {
            const lastPoint = timePoints[timePoints.length - 1];
            const { type } = lastPoint.period;
            const periodLength = type === 'day' ? 1 : type === 'week' ? 7 : 28;
            let nextDay = lastPoint.period.startDay + periodLength;

            while (nextDay <= totalDays) {
                completeTimeline.push({
                    period: { type, startDay: nextDay },
                    base: { 
                        rate: null, 
                        rateCI: [null, null], 
                        visitors: null, 
                        conversions: null,
                        cumulativeRate: null,
                        cumulativeRateCI: [null, null]
                    },
                    variant: { 
                        rate: null, 
                        rateCI: [null, null], 
                        visitors: null, 
                        conversions: null,
                        cumulativeRate: null,
                        cumulativeRateCI: [null, null]
                    }
                });
                nextDay += periodLength;
            }
        }

        // Create labels based on time period
        const labels = completeTimeline.map(point => {
            const { type, startDay } = point.period;
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
            let datasets = [];

            if (viewType === 'daily') {
                datasets = [
                    {
                        label: `Base ${timelineData.timePeriod}ly Rate`,
                        data: completeTimeline.map(d => d.base.rate ? Number(d.base.rate.toFixed(4)) : null),
                        borderColor: 'rgb(147, 51, 234)',
                        backgroundColor: 'transparent',
                        fill: false,
                        tension: 0.4,
                        spanGaps: true
                    },
                    {
                        label: 'Base CI Lower',
                        data: completeTimeline.map(d => d.base.rateCI && d.base.rateCI[0] ? Number(d.base.rateCI[0].toFixed(4)) : null),
                        borderColor: 'transparent',
                        backgroundColor: 'rgba(147, 51, 234, 0.1)',
                        fill: '+1',
                        tension: 0.4,
                        spanGaps: true
                    },
                    {
                        label: 'Base CI Upper',
                        data: completeTimeline.map(d => d.base.rateCI && d.base.rateCI[1] ? Number(d.base.rateCI[1].toFixed(4)) : null),
                        borderColor: 'transparent',
                        fill: false,
                        tension: 0.4,
                        spanGaps: true
                    },
                    {
                        label: `Test ${timelineData.timePeriod}ly Rate`,
                        data: completeTimeline.map(d => d.variant.rate ? Number(d.variant.rate.toFixed(4)) : null),
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'transparent',
                        fill: false,
                        tension: 0.4,
                        spanGaps: true
                    },
                    {
                        label: 'Test CI Lower',
                        data: completeTimeline.map(d => d.variant.rateCI && d.variant.rateCI[0] ? Number(d.variant.rateCI[0].toFixed(4)) : null),
                        borderColor: 'transparent',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: '+1',
                        tension: 0.4,
                        spanGaps: true
                    },
                    {
                        label: 'Test CI Upper',
                        data: completeTimeline.map(d => d.variant.rateCI && d.variant.rateCI[1] ? Number(d.variant.rateCI[1].toFixed(4)) : null),
                        borderColor: 'transparent',
                        fill: false,
                        tension: 0.4,
                        spanGaps: true
                    }
                ];
            } else {
                datasets = [
                    {
                        label: 'Base Cumulative Rate',
                        data: completeTimeline.map(d => d.base.cumulativeRate ? Number(d.base.cumulativeRate.toFixed(4)) : null),
                        borderColor: 'rgb(107, 11, 194)',
                        backgroundColor: 'transparent',
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.4,
                        spanGaps: true
                    },
                    {
                        label: 'Base CI Lower',
                        data: completeTimeline.map(d => d.base.cumulativeRateCI && d.base.cumulativeRateCI[0] ? Number(d.base.cumulativeRateCI[0].toFixed(4)) : null),
                        borderColor: 'transparent',
                        backgroundColor: 'rgba(107, 11, 194, 0.1)',
                        fill: '+1',
                        tension: 0.4,
                        spanGaps: true
                    },
                    {
                        label: 'Base CI Upper',
                        data: completeTimeline.map(d => d.base.cumulativeRateCI && d.base.cumulativeRateCI[1] ? Number(d.base.cumulativeRateCI[1].toFixed(4)) : null),
                        borderColor: 'transparent',
                        fill: false,
                        tension: 0.4,
                        spanGaps: true
                    },
                    {
                        label: 'Test Cumulative Rate',
                        data: completeTimeline.map(d => d.variant.cumulativeRate ? Number(d.variant.cumulativeRate.toFixed(4)) : null),
                        borderColor: 'rgb(19, 90, 206)',
                        backgroundColor: 'transparent',
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.4,
                        spanGaps: true
                    },
                    {
                        label: 'Test CI Lower',
                        data: completeTimeline.map(d => d.variant.cumulativeRateCI && d.variant.cumulativeRateCI[0] ? Number(d.variant.cumulativeRateCI[0].toFixed(4)) : null),
                        borderColor: 'transparent',
                        backgroundColor: 'rgba(19, 90, 206, 0.1)',
                        fill: '+1',
                        tension: 0.4,
                        spanGaps: true
                    },
                    {
                        label: 'Test CI Upper',
                        data: completeTimeline.map(d => d.variant.cumulativeRateCI && d.variant.cumulativeRateCI[1] ? Number(d.variant.cumulativeRateCI[1].toFixed(4)) : null),
                        borderColor: 'transparent',
                        fill: false,
                        tension: 0.4,
                        spanGaps: true
                    }
                ];
            }

            // Calculate y-axis range based on the datasets
            const yAxisRange = calculateYAxisRange(datasets);
            datasets.yAxisRange = yAxisRange;

            return datasets;
        }

        // Initialize the chart with daily view
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: createDatasets('daily')
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
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
                        }
                    },
                    title: {
                        display: true,
                        text: `${timelineData.timePeriod.charAt(0).toUpperCase() + timelineData.timePeriod.slice(1)}ly Conversion Rates`
                    },
                    tooltip: {
                        mode: 'point',
                        intersect: true,
                        position: 'nearest'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatPercent(value);
                            }
                        }
                    }
                }
            }
        });

        // Add view toggle functionality
        const viewToggle = document.getElementById('chart-view-toggle');
        if (viewToggle) {
            viewToggle.options[0].text = `${timelineData.timePeriod.charAt(0).toUpperCase() + timelineData.timePeriod.slice(1)}ly View`;

            viewToggle.addEventListener('change', function(e) {
                const viewType = e.target.value;
                const datasets = createDatasets(viewType);

                // Update chart data and options
                chart.data.datasets = datasets;
                chart.options.plugins.title.text = viewType === 'daily' ?
                    `${timelineData.timePeriod.charAt(0).toUpperCase() + timelineData.timePeriod.slice(1)}ly Conversion Rates` :
                    'Cumulative Conversion Rates';

                if (datasets.yAxisRange) {
                    chart.options.scales.y.min = datasets.yAxisRange.min;
                    chart.options.scales.y.max = datasets.yAxisRange.max;
                }

                chart.update();
            });
        }

        return chart;
    } catch (error) {
        console.error('Error rendering chart:', error);
        return null;
    }
}

function calculateYAxisRange(datasets) {
    try {
        let allValues = [];
        datasets.forEach(dataset => {
            if (!dataset.label.includes('CI')) {
                allValues = allValues.concat(dataset.data.filter(v => v !== null));
            }
        });

        if (allValues.length === 0) return { min: 0, max: 1 };

        const maxValue = Math.max(...allValues);
        const nonZeroValues = allValues.filter(v => v > 0);
        const minValue = nonZeroValues.length > 0 ? Math.min(...nonZeroValues) : 0;

        return {
            min: Math.max(0, minValue - (minValue * 0.2)),
            max: maxValue + (maxValue * 0.1)
        };
    } catch (error) {
        console.error('Error calculating Y axis range:', error);
        return { min: 0, max: 1 };
    }
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
    const totalDays = challenge.experiment.requiredRuntimeDays;
    const currentDays = challenge.simulation.timeline.currentRuntimeDays;

    // Generate complete timeline including future empty periods
    const completeTimeline = [...timePoints];
    if (currentDays < totalDays) {
        const lastPoint = timePoints[timePoints.length - 1];
        const { type } = lastPoint.period;
        const periodLength = type === 'day' ? 1 : type === 'week' ? 7 : 28;
        let nextDay = lastPoint.period.startDay + periodLength;

        while (nextDay <= totalDays) {
            completeTimeline.push({
                period: { type, startDay: nextDay },
                base: { visitors: null, cumulativeVisitors: null },
                variant: { visitors: null, cumulativeVisitors: null }
            });
            nextDay += periodLength;
        }
    }

    // Create labels based on time period
    const labels = completeTimeline.map(point => {
        const { type, startDay } = point.period;
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
                data: completeTimeline.map(d => d.base.visitors),
                borderColor: 'rgb(147, 51, 234)',
                backgroundColor: 'rgba(147, 51, 234, 0.1)',
                fill: true,
                spanGaps: true
            },
            {
                label: 'Test Visitors',
                data: completeTimeline.map(d => d.variant.visitors),
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                spanGaps: true
            }
        ] : [
            {
                label: 'Base Cumulative Visitors',
                data: completeTimeline.map(d => d.base.cumulativeVisitors),
                borderColor: 'rgb(107, 11, 194)',
                backgroundColor: 'rgba(107, 11, 194, 0.1)',
                fill: true,
                borderDash: [5, 5],
                spanGaps: true
            },
            {
                label: 'Test Cumulative Visitors',
                data: completeTimeline.map(d => d.variant.cumulativeVisitors),
                borderColor: 'rgb(19, 90, 206)',
                backgroundColor: 'rgba(19, 90, 206, 0.1)',
                fill: true,
                borderDash: [5, 5],
                spanGaps: true
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
                            const timePoint = completeTimeline[context.dataIndex];
                            const value = context.parsed.y;
                            return [
                                `${context.dataset.label}: ${value.toLocaleString()}`
                            ];
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: false // Remove y-axis title
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