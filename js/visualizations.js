// UI State Management
const UIState = {
    currentExperiment: 1,
    score: 0,
    streak: 0,
    totalAttempts: 0,
    trustDecision: null,
    implementDecision: null,
    EXPERIMENTS_PER_SESSION: 3,
    
    updateScore(newScore) {
        this.score = newScore;
        this.updateScoreDisplay();
    },
    
    updateStreak(newStreak) {
        this.streak = newStreak;
        this.updateStreakDisplay();
    },
    
    updateAccuracy() {
        const accuracy = Math.round((this.score / this.totalAttempts) * 100);
        this.updateAccuracyDisplay(accuracy);
    },
    
    updateScoreDisplay() {
        const scoreElement = document.getElementById('score');
        if (scoreElement) scoreElement.textContent = this.score;
    },
    
    updateStreakDisplay() {
        const streakElement = document.getElementById('streak');
        if (streakElement) streakElement.textContent = this.streak;
    },
    
    updateAccuracyDisplay(accuracy) {
        const accuracyElement = document.getElementById('accuracy');
        if (accuracyElement) accuracyElement.textContent = `${accuracy}%`;
    },
    
    reset() {
        this.currentExperiment = 1;
        this.score = 0;
        this.streak = 0;
        this.totalAttempts = 0;
        this.trustDecision = null;
        this.implementDecision = null;
        this.updateScoreDisplay();
        this.updateStreakDisplay();
        this.updateAccuracyDisplay(0);
    }
};

// Modal Management
const ModalManager = {
    modals: {
        feedback: 'feedback-modal',
        completion: 'completion-modal',
        cheatSheet: 'cheat-sheet-modal'
    },
    
    show(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            setTimeout(() => modal.classList.add('fade-in'), 10);
        }
    },
    
    hide(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('fade-out');
            setTimeout(() => {
                modal.classList.add('hidden');
                modal.classList.remove('fade-out');
            }, 500);
        }
    },
    
    showFeedback(correct, message) {
        const modal = document.getElementById(this.modals.feedback);
        if (!modal) return;
        
        const icon = document.getElementById('feedback-icon');
        const title = document.getElementById('feedback-title');
        
        if (correct) {
            icon.className = 'mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100';
            icon.innerHTML = '<svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
            title.textContent = 'Correct!';
            title.className = 'text-lg leading-6 font-medium text-green-900 mt-4';
        } else {
            icon.className = 'mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100';
            icon.innerHTML = '<svg class="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
            title.textContent = 'Incorrect';
            title.className = 'text-lg leading-6 font-medium text-red-900 mt-4';
        }
        
        document.getElementById('feedback-message').textContent = message;
        this.show(this.modals.feedback);
    },
    
    showCompletion(score, accuracy) {
        document.getElementById('final-score').textContent = score;
        document.getElementById('final-accuracy').textContent = `${accuracy}%`;
        this.show(this.modals.completion);
    }
};

const chartOptions = {
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
        tooltip: {
            enabled: true,
            mode: 'index',
            intersect: false,
            filter: function(tooltipItem) {
                // Only show tooltips for main data lines (not CI bounds)
                return !tooltipItem.dataset.isCI;
            },
            callbacks: {
                title: function(context) {
                    if (context.length === 0) return '';
                    return context[0].label;
                },
                label: function(context) {
                    // Skip CI datasets
                    if (context.dataset.isCI) return null;

                    const timePoint = completeTimeline[context.dataIndex];
                    const isBase = context.dataset.label.toLowerCase().includes('base');
                    const isCumulative = context.dataset.label.toLowerCase().includes('cumulative');
                    const data = isBase ? timePoint.base : timePoint.variant;

                    if (!data) return null;

                    // Get the appropriate metrics based on view type
                    const rate = isCumulative ? data.cumulativeRate : data.rate;
                    const ci = isCumulative ? data.cumulativeRateCI : data.rateCI;
                    const visitors = isCumulative ? data.cumulativeVisitors : data.visitors;
                    const conversions = isCumulative ? data.cumulativeConversions : data.conversions;

                    // Format the tooltip lines
                    return [
                        `${isBase ? 'Base' : 'Test'} Metrics:`,
                        `Rate: ${formatPercent(rate)}`,
                        `CI: ${formatPercent(ci[0])} - ${formatPercent(ci[1])}`,
                        `Visitors: ${visitors.toLocaleString()}`,
                        `Conversions: ${conversions.toLocaleString()}`
                    ];
                }
            }
        }
    }
};

// Define the renderChart function before it's used
function renderChart(challenge) {
    const timelineData = challenge.simulation.timeline;
    const timePoints = timelineData.timePoints;
    const totalDays = challenge.experiment.requiredRuntimeDays;
    const currentDays = challenge.simulation.timeline.currentRuntimeDays;
    const confidenceLevel = calculateConfidenceLevel(challenge.experiment.alpha);

    // Generate complete timeline including future empty periods
    window.completeTimeline = [...timePoints];
    if (currentDays < totalDays) {
        const lastPoint = timePoints[timePoints.length - 1];
        const {type} = lastPoint.period;
        const periodLength = type === 'day' ? 1 : type === 'week' ? 7 : 28;
        let nextDay = lastPoint.period.startDay + periodLength;

        while (nextDay <= totalDays) {
            completeTimeline.push({
                period: {type, startDay: nextDay},
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
        const {type, startDay} = point.period;
        if (type === 'day') {
            return `Day ${startDay}`;
        } else if (type === 'week') {
            return `Week ${Math.ceil(startDay / 7)}`;
        } else {
            return `Month ${Math.ceil(startDay / 28)}`;
        }
    });

    // Create datasets based on the view type
    function createDatasets(viewType) {
        const datasets = viewType === 'daily' ? [
            {
                label: `Base ${timelineData.timePeriod}ly Rate`,
                data: completeTimeline.map(d => d.base.rate ? Number(d.base.rate.toFixed(4)) : null),
                borderColor: 'rgb(147, 51, 234)',
                backgroundColor: 'transparent',
                fill: false,
                tension: 0.4,
                spanGaps: true,
                isCI: false
            },
            {
                label: 'Base CI Lower',
                data: completeTimeline.map(d => d.base.rateCI && d.base.rateCI[0] ? Number(d.base.rateCI[0].toFixed(4)) : null),
                borderColor: 'transparent',
                backgroundColor: 'rgba(147, 51, 234, 0.1)',
                fill: '+1',
                tension: 0.4,
                spanGaps: true,
                isCI: true
            },
            {
                label: 'Base CI Upper',
                data: completeTimeline.map(d => d.base.rateCI && d.base.rateCI[1] ? Number(d.base.rateCI[1].toFixed(4)) : null),
                borderColor: 'transparent',
                fill: false,
                tension: 0.4,
                spanGaps: true,
                isCI: true
            },
            {
                label: `Test ${timelineData.timePeriod}ly Rate`,
                data: completeTimeline.map(d => d.variant.rate ? Number(d.variant.rate.toFixed(4)) : null),
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'transparent',
                fill: false,
                tension: 0.4,
                spanGaps: true,
                isCI: false
            },
            {
                label: 'Test CI Lower',
                data: completeTimeline.map(d => d.variant.rateCI && d.variant.rateCI[0] ? Number(d.variant.rateCI[0].toFixed(4)) : null),
                borderColor: 'transparent',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: '+1',
                tension: 0.4,
                spanGaps: true,
                isCI: true
            },
            {
                label: 'Test CI Upper',
                data: completeTimeline.map(d => d.variant.rateCI && d.variant.rateCI[1] ? Number(d.variant.rateCI[1].toFixed(4)) : null),
                borderColor: 'transparent',
                fill: false,
                tension: 0.4,
                spanGaps: true,
                isCI: true
            }
        ] : [
            {
                label: 'Base Cumulative Rate',
                data: completeTimeline.map(d => d.base.cumulativeRate ? Number(d.base.cumulativeRate.toFixed(4)) : null),
                borderColor: 'rgb(107, 11, 194)',
                backgroundColor: 'transparent',
                borderDash: [5, 5],
                fill: false,
                tension: 0.4,
                spanGaps: true,
                isCI: false
            },
            {
                label: 'Base CI Lower',
                data: completeTimeline.map(d => d.base.cumulativeRateCI && d.base.cumulativeRateCI[0] ? Number(d.base.cumulativeRateCI[0].toFixed(4)) : null),
                borderColor: 'transparent',
                backgroundColor: 'rgba(107, 11, 194, 0.1)',
                fill: '+1',
                tension: 0.4,
                spanGaps: true,
                isCI: true
            },
            {
                label: 'Base CI Upper',
                data: completeTimeline.map(d => d.base.cumulativeRateCI && d.base.cumulativeRateCI[1] ? Number(d.base.cumulativeRateCI[1].toFixed(4)) : null),
                borderColor: 'transparent',
                fill: false,
                tension: 0.4,
                spanGaps: true,
                isCI: true
            },
            {
                label: 'Test Cumulative Rate',
                data: completeTimeline.map(d => d.variant.cumulativeRate ? Number(d.variant.cumulativeRate.toFixed(4)) : null),
                borderColor: 'rgb(19, 90, 206)',
                backgroundColor: 'transparent',
                borderDash: [5, 5],
                fill: false,
                tension: 0.4,
                spanGaps: true,
                isCI: false
            },
            {
                label: 'Test CI Lower',
                data: completeTimeline.map(d => d.variant.cumulativeRateCI && d.variant.cumulativeRateCI[0] ? Number(d.variant.cumulativeRateCI[0].toFixed(4)) : null),
                borderColor: 'transparent',
                backgroundColor: 'rgba(19, 90, 206, 0.1)',
                fill: '+1',
                tension: 0.4,
                spanGaps: true,
                isCI: true
            },
            {
                label: 'Test CI Upper',
                data: completeTimeline.map(d => d.variant.cumulativeRateCI && d.variant.cumulativeRateCI[1] ? Number(d.variant.cumulativeRateCI[1].toFixed(4)) : null),
                borderColor: 'transparent',
                fill: false,
                tension: 0.4,
                spanGaps: true,
                isCI: true
            }
        ];

        // Calculate y-axis range based on the datasets
        const yAxisRange = calculateYAxisRange(datasets);
        datasets.yAxisRange = yAxisRange;

        return datasets;
    }

    // Initialize chart with daily view
    const chart = ChartManager.createChart('conversion-chart', 'line', {
        labels,
            datasets: createDatasets('daily')
    }, {
            plugins: {
                ...chartOptions.plugins,
                title: {
                    display: true,
                    text: `${timelineData.timePeriod.charAt(0).toUpperCase() + timelineData.timePeriod.slice(1)}ly Conversion Rates`
            },
            tooltip: {
                ...chartOptions.plugins.tooltip,
                callbacks: {
                    title: function(context) {
                        if (context.length === 0) return '';
                        return context[0].label;
                    },
                    label: function(context) {
                        // Skip CI datasets
                        if (context.dataset.isCI) return null;

                        const timePoint = completeTimeline[context.dataIndex];
                        const isBase = context.dataset.label.toLowerCase().includes('base');
                        const isCumulative = context.dataset.label.toLowerCase().includes('cumulative');
                        const data = isBase ? timePoint.base : timePoint.variant;

                        if (!data) return null;

                        // Get the appropriate metrics based on view type
                        const rate = isCumulative ? data.cumulativeRate : data.rate;
                        const ci = isCumulative ? data.cumulativeRateCI : data.rateCI;
                        const visitors = isCumulative ? data.cumulativeVisitors : data.visitors;
                        const conversions = isCumulative ? data.cumulativeConversions : data.conversions;

                        // Format the tooltip lines
                        return [
                            `${isBase ? 'Base' : 'Test'} Metrics:`,
                            `Rate: ${formatPercent(rate)}`,
                            `CI: ${formatPercent(ci[0])} - ${formatPercent(ci[1])}`,
                            `Visitors: ${visitors.toLocaleString()}`,
                            `Conversions: ${conversions.toLocaleString()}`
                        ];
                    }
                }
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
    });

    // Add view toggle functionality
    const viewToggle = document.getElementById('chart-view-toggle');
    if (viewToggle) {
        viewToggle.options[0].text = `${timelineData.timePeriod.charAt(0).toUpperCase() + timelineData.timePeriod.slice(1)}ly View`;

        viewToggle.addEventListener('change', function(e) {
                    const viewType = e.target.value;
                    const datasets = createDatasets(viewType);

            ChartManager.updateChart('conversion-chart', {
                labels,
                datasets
            }, {
                            plugins: {
                                ...chartOptions.plugins,
                                title: {
                                    display: true,
                                    text: viewType === 'daily' ?
                                        `${timelineData.timePeriod.charAt(0).toUpperCase() + timelineData.timePeriod.slice(1)}ly Conversion Rates` :
                                        'Cumulative Conversion Rates'
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    min: datasets.yAxisRange ? datasets.yAxisRange.min : undefined,
                                    max: datasets.yAxisRange ? datasets.yAxisRange.max : undefined,
                                    ticks: {
                                        callback: function(value) {
                                            return formatPercent(value);
                                    }
                                }
                            }
                        }
                    });
        });
    }

    return chart;
}

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
    return percentage.toFixed(2) + '%';
}

function formatDecimal(value) {
    return value.toFixed(4);
}

function updateConfidenceIntervals(challenge) {
    // Update CI column header
    const ciHeader = document.getElementById('ci-header');
    if (ciHeader) {
        const confidenceLevel = calculateConfidenceLevel(challenge.experiment.alpha);
        ciHeader.textContent = `${confidenceLevel}% Confidence Intervals`;
    }

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

function calculateYAxisRange(datasets) {
    try {
        let allValues = [];
        datasets.forEach(dataset => {
            if (!dataset.label.includes('CI')) {
                allValues = allValues.concat(dataset.data.filter(v => v !== null));
            }
        });

        if (allValues.length === 0) return {min: 0, max: 1};

        const maxValue = Math.max(...allValues);
        const nonZeroValues = allValues.filter(v => v > 0);
        const minValue = nonZeroValues.length > 0 ? Math.min(...nonZeroValues) : 0;

        return {
            min: Math.max(0, minValue - (minValue * 0.2)),
            max: maxValue + (maxValue * 0.1)
        };
    } catch (error) {
        console.error('Error calculating Y axis range:', error);
        return {min: 0, max: 1};
    }
}

function renderVisitorsChart(challenge) {
    const canvas = document.getElementById('visitors-chart');
    if (!canvas) {
        console.error('Visitors chart canvas not found');
        return;
    }

    try {
        // Get timeline data and setup datasets
        const timelineData = challenge.simulation.timeline;
        const timePoints = timelineData.timePoints;
        const totalDays = challenge.experiment.requiredRuntimeDays;
        const currentDays = challenge.simulation.timeline.currentRuntimeDays;

        // Generate complete timeline including future empty periods
        const completeTimeline = [...timePoints];
        if (currentDays < totalDays) {
            const lastPoint = timePoints[timePoints.length - 1];
            const {type} = lastPoint.period;
            const periodLength = type === 'day' ? 1 : type === 'week' ? 7 : 28;
            let nextDay = lastPoint.period.startDay + periodLength;

            while (nextDay <= totalDays) {
                completeTimeline.push({
                    period: {type, startDay: nextDay},
                    base: {
                        visitors: null,
                        cumulativeVisitors: null
                    },
                    variant: {
                        visitors: null,
                        cumulativeVisitors: null
                    }
                });
                nextDay += periodLength;
            }
        }

        // Create labels
        const labels = completeTimeline.map(point => {
            const {type, startDay} = point.period;
            if (type === 'day') {
                return `Day ${startDay}`;
            } else if (type === 'week') {
                return `Week ${Math.ceil(startDay / 7)}`;
            } else {
                return `Month ${Math.ceil(startDay / 28)}`;
            }
        });

        // Create datasets based on view type
        function createDatasets(viewType) {
            return viewType === 'daily' ? [
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
        }

        // Initialize chart with daily view
        const chart = ChartManager.createChart('visitors-chart', 'line', {
                labels: labels,
                datasets: createDatasets('daily')
        }, {
                ...chartOptions,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value.toLocaleString();
                        }
                    }
                }
            }
        });

        // Add view toggle functionality
        const viewToggle = document.getElementById('visitors-view-toggle');
        if (viewToggle) {
            viewToggle.addEventListener('change', function(e) {
                const viewType = e.target.value;
                const datasets = createDatasets(viewType);

                ChartManager.updateChart('visitors-chart', {
                    labels,
                    datasets
                }, {
                    ...chartOptions,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return value.toLocaleString();
                                }
                            }
                        }
                    }
                });
            });
        }

        return chart;
    } catch (error) {
        console.error('Error rendering visitors chart:', error);
        return null;
    }
}

function renderDifferenceChart(challenge) {
    const canvas = document.getElementById('difference-chart');
    if (!canvas) return;

    try {
        const timelineData = challenge.simulation.timeline;
        const timePoints = timelineData.timePoints;
        const totalDays = challenge.experiment.requiredRuntimeDays;
        const currentDays = challenge.simulation.timeline.currentRuntimeDays;
        const confidenceLevel = calculateConfidenceLevel(challenge.experiment.alpha);

        // Generate complete timeline including future empty periods
        const completeTimeline = [...timePoints];
        if (currentDays < totalDays) {
            const lastPoint = timePoints[timePoints.length - 1];
            const {type} = lastPoint.period;
            const periodLength = type === 'day' ? 1 : type === 'week' ? 7 : 28;
            let nextDay = lastPoint.period.startDay + periodLength;

            while (nextDay <= totalDays) {
                completeTimeline.push({
                    period: {type, startDay: nextDay},
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
                    },
                    difference: {
                        rate: null,
                        rateCI: [null, null],
                        cumulativeRate: null,
                        cumulativeRateCI: [null, null]
                    },
                    uplift: {
                        rate: null,
                        rateCI: [null, null],
                        cumulativeRate: null,
                        cumulativeRateCI: [null, null]
                    }
                });
                nextDay += periodLength;
            }
        }

        // Create labels
        const labels = completeTimeline.map(point => {
            const {type, startDay} = point.period;
            if (type === 'day') {
                return `Day ${startDay}`;
            } else if (type === 'week') {
                return `Week ${Math.ceil(startDay / 7)}`;
            } else {
                return `Month ${Math.ceil(startDay / 28)}`;
            }
        });

        // Create datasets based on view type and difference type
        function createDatasets(viewType, diffType) {
            const isUplift = diffType === 'uplift';
            const datasets = viewType === 'daily' ? [
                {
                    label: isUplift ? 'Uplift' : 'Rate Difference',
                    data: completeTimeline.map(d => {
                        if (!d[diffType] || d[diffType].rate === null) return null;
                        return isUplift ? d[diffType].rate * 100 : d[diffType].rate * 100;
                    }),
                    borderColor: isUplift ? 'rgb(16, 185, 129)' : 'rgb(59, 130, 246)',
                    backgroundColor: 'transparent',
                    fill: false,
                    tension: 0.4,
                    spanGaps: true
                },
                {
                    label: 'CI Upper',
                    data: completeTimeline.map(d => {
                        if (!d[diffType] || d[diffType].rateCI === null || d[diffType].rate === null) return null;
                        return d[diffType].rateCI[1] * 100;
                    }),
                    borderColor: 'transparent',
                    backgroundColor: isUplift ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                    fill: '+1',
                    tension: 0.4,
                    spanGaps: true,
                    isCI: true
                },
                {
                    label: 'CI Lower',
                    data: completeTimeline.map(d => {
                        if (!d[diffType] || d[diffType].rateCI === null || d[diffType].rate === null) return null;
                        return d[diffType].rateCI[0] * 100;
                    }),
                    borderColor: 'transparent',
                    fill: false,
                    tension: 0.4,
                    spanGaps: true,
                    isCI: true
                }
            ] : [
                {
                    label: isUplift ? 'Cumulative Uplift' : 'Cumulative Rate Difference',
                    data: completeTimeline.map(d => {
                        if (!d[diffType] || d[diffType].cumulativeRate === null) return null;
                        return isUplift ? d[diffType].cumulativeRate * 100 : d[diffType].cumulativeRate * 100;
                    }),
                    borderColor: isUplift ? 'rgb(5, 150, 105)' : 'rgb(19, 90, 206)',
                    backgroundColor: 'transparent',
                    fill: false,
                    tension: 0.4,
                    borderDash: [5, 5],
                    spanGaps: true
                },
                {
                    label: 'CI Upper',
                    data: completeTimeline.map(d => {
                        if (!d[diffType] || d[diffType].cumulativeRateCI === null || d[diffType].cumulativeRate === null) return null;
                        return d[diffType].cumulativeRateCI[1] * 100;
                    }),
                    borderColor: 'transparent',
                    backgroundColor: isUplift ? 'rgba(5, 150, 105, 0.1)' : 'rgba(19, 90, 206, 0.1)',
                    fill: '+1',
                    tension: 0.4,
                    spanGaps: true,
                    isCI: true
                },
                {
                    label: 'CI Lower',
                    data: completeTimeline.map(d => {
                        if (!d[diffType] || d[diffType].cumulativeRateCI === null || d[diffType].cumulativeRate === null) return null;
                        return d[diffType].cumulativeRateCI[0] * 100;
                    }),
                    borderColor: 'transparent',
                    fill: false,
                    tension: 0.4,
                    spanGaps: true,
                    isCI: true
                }
            ];

            return datasets;
        }

        // Initialize chart with daily view and absolute difference
        const chart = ChartManager.createChart('difference-chart', 'line', {
            labels,
            datasets: createDatasets('daily', 'difference')
        }, {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
                                scales: {
                                    y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Rate Difference (%)'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    viewType: 'daily',
                    diffType: 'difference',
                    confidenceLevel: confidenceLevel,
                    callbacks: {
                        title: function(context) {
                            if (context.length === 0) return '';
                            return context[0].label;
                        },
                        label: function(context) {
                            const timePoint = completeTimeline[context.dataIndex];
                            if (!timePoint || !timePoint.base || !timePoint.variant) return null;

                            const isCumulative = this.chart.options.plugins.tooltip.viewType === 'cumulative';
                            const isUplift = this.chart.options.plugins.tooltip.diffType === 'uplift';
                            const baseRate = isCumulative ? timePoint.base.cumulativeRate : timePoint.base.rate;
                            const baseCI = isCumulative ? timePoint.base.cumulativeRateCI : timePoint.base.rateCI;
                            const baseVisitors = isCumulative ? timePoint.base.cumulativeVisitors : timePoint.base.visitors;
                            const variantRate = isCumulative ? timePoint.variant.cumulativeRate : timePoint.variant.rate;
                            const variantCI = isCumulative ? timePoint.variant.cumulativeRateCI : timePoint.variant.rateCI;
                            const variantVisitors = isCumulative ? timePoint.variant.cumulativeVisitors : timePoint.variant.visitors;

                            // Check if any required data is missing
                            if (baseRate === null || variantRate === null || 
                                baseVisitors === null || variantVisitors === null ||
                                !baseCI || !variantCI) {
                                return null;
                            }

                            if (context.datasetIndex === 0) {
                                const diffData = isUplift ? timePoint.uplift : timePoint.difference;
                                const diffCI = isCumulative ? diffData.cumulativeRateCI : diffData.rateCI;
                                const diffValue = isCumulative ? diffData.cumulativeRate : diffData.rate;
                                const diffLabel = isUplift ? 'Uplift' : 'Difference';

                                return [
                                    `Base: ${formatPercent(baseRate)} (${baseVisitors.toLocaleString()} visitors)`,
                                    `Variant: ${formatPercent(variantRate)} (${variantVisitors.toLocaleString()} visitors)`,
                                    `${diffLabel}: ${formatPercent(diffValue)}`,
                                    `${this.chart.options.plugins.tooltip.confidenceLevel}% CI: [${formatPercent(diffCI[0])}, ${formatPercent(diffCI[1])}]`
                                ];
                            }
                            return null;
                        }
                    }
                                }
                            }
                        });

        // Add view toggle functionality
        const viewToggle = document.getElementById('difference-view-toggle');
        const diffTypeToggle = document.getElementById('difference-type-toggle');

        function updateChart(viewType, diffType) {
            const datasets = createDatasets(viewType, diffType);
            const yAxisTitle = diffType === 'uplift' ? 'Uplift (%)' : 'Rate Difference (%)';

            ChartManager.updateChart('difference-chart', {
                labels,
                datasets
            }, {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: yAxisTitle
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        viewType: viewType,
                        diffType: diffType,
                        confidenceLevel: confidenceLevel,
                        callbacks: {
                            title: function(context) {
                                if (context.length === 0) return '';
                                return context[0].label;
                            },
                            label: function(context) {
                                const timePoint = completeTimeline[context.dataIndex];
                                if (!timePoint || !timePoint.base || !timePoint.variant) return null;

                                const isCumulative = this.chart.options.plugins.tooltip.viewType === 'cumulative';
                                const isUplift = this.chart.options.plugins.tooltip.diffType === 'uplift';
                                const baseRate = isCumulative ? timePoint.base.cumulativeRate : timePoint.base.rate;
                                const baseCI = isCumulative ? timePoint.base.cumulativeRateCI : timePoint.base.rateCI;
                                const baseVisitors = isCumulative ? timePoint.base.cumulativeVisitors : timePoint.base.visitors;
                                const variantRate = isCumulative ? timePoint.variant.cumulativeRate : timePoint.variant.rate;
                                const variantCI = isCumulative ? timePoint.variant.cumulativeRateCI : timePoint.variant.rateCI;
                                const variantVisitors = isCumulative ? timePoint.variant.cumulativeVisitors : timePoint.variant.visitors;

                                // Check if any required data is missing
                                if (baseRate === null || variantRate === null || 
                                    baseVisitors === null || variantVisitors === null ||
                                    !baseCI || !variantCI) {
                                    return null;
                                }

                                if (context.datasetIndex === 0) {
                                    const diffData = isUplift ? timePoint.uplift : timePoint.difference;
                                    const diffCI = isCumulative ? diffData.cumulativeRateCI : diffData.rateCI;
                                    const diffValue = isCumulative ? diffData.cumulativeRate : diffData.rate;
                                    const diffLabel = isUplift ? 'Uplift' : 'Difference';

                                    return [
                                        `Base: ${formatPercent(baseRate)} (${baseVisitors.toLocaleString()} visitors)`,
                                        `Variant: ${formatPercent(variantRate)} (${variantVisitors.toLocaleString()} visitors)`,
                                        `${diffLabel}: ${formatPercent(diffValue)}`,
                                        `${this.chart.options.plugins.tooltip.confidenceLevel}% CI: [${formatPercent(diffCI[0])}, ${formatPercent(diffCI[1])}]`
                                    ];
                                }
                                return null;
                            }
                        }
                    }
                }
            });
        }

        if (viewToggle) {
            viewToggle.addEventListener('change', function(e) {
                const viewType = e.target.value;
                const diffType = diffTypeToggle ? diffTypeToggle.value : 'difference';
                updateChart(viewType, diffType);
            });
        }

        if (diffTypeToggle) {
            diffTypeToggle.addEventListener('change', function(e) {
                const diffType = e.target.value;
                const viewType = viewToggle ? viewToggle.value : 'daily';
                updateChart(viewType, diffType);
            });
        }

        return chart;
    } catch (error) {
        console.error('Error rendering difference chart:', error);
        return null;
    }
}

// Make sure charts resize properly
window.addEventListener('resize', function () {
    const conversionChart = Chart.getChart('conversion-chart');
    if (conversionChart) conversionChart.resize();

    const visitorsChart = Chart.getChart('visitors-chart');
    if (visitorsChart) visitorsChart.resize();
});

function initializeCharts(challenge) {
    try {
        // Reset all view toggles to 'daily' first
        const toggles = ['chart-view-toggle', 'visitors-view-toggle', 'difference-view-toggle'];
        toggles.forEach(toggleId => {
            const toggle = document.getElementById(toggleId);
            if (toggle) {
                toggle.value = 'daily';
            }
        });

        // Clean up all existing charts
        const chartIds = ['conversion-chart', 'visitors-chart', 'difference-chart'];
        chartIds.forEach(chartId => {
            const canvas = document.getElementById(chartId);
            if (canvas) {
                const existingChart = Chart.getChart(canvas);
            if (existingChart) {
                existingChart.destroy();
            }
        }
        });

        // Destroy all charts in ChartManager
        ChartManager.destroyAllCharts();

        // Clear the completeTimeline global variable
        window.completeTimeline = null;

        // Initialize all charts in the correct order
        updateConfidenceIntervals(challenge);
        renderChart(challenge);
        renderVisitorsChart(challenge);
        renderDifferenceChart(challenge);
    } catch (error) {
        console.error('Error initializing visualizations:', error);
    }
}

// Chart Management
const ChartManager = {
    charts: {},
    
    createChart(canvasId, type, data, options) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas ${canvasId} not found`);
            return null;
        }
        
        // Destroy existing chart if it exists
        this.destroyChart(canvasId);
        
        // Create new chart
        this.charts[canvasId] = new Chart(canvas, {
            type,
            data,
            options: {
                ...chartOptions,
                ...options
            }
        });
        
        return this.charts[canvasId];
    },
    
    updateChart(canvasId, data, options = {}) {
        const chart = this.charts[canvasId];
        if (!chart) return;
        
        chart.data = data;
        if (options) {
            chart.options = {
                ...chart.options,
                ...options
            };
        }
        chart.update();
    },
    
    destroyChart(canvasId) {
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
            delete this.charts[canvasId];
        }
        // Also destroy any Chart.js instance on the canvas
        const canvas = document.getElementById(canvasId);
        if (canvas) {
            const existingChart = Chart.getChart(canvas);
            if (existingChart) {
                existingChart.destroy();
            }
        }
    },
    
    destroyAllCharts() {
        Object.keys(this.charts).forEach(canvasId => {
            this.destroyChart(canvasId);
        });
    },
    
    resizeCharts() {
        Object.values(this.charts).forEach(chart => {
            chart.resize();
        });
    }
};

// Add resize handler
window.addEventListener('resize', () => ChartManager.resizeCharts());

function updateProgressBar(challenge) {
    const progressBar = document.getElementById('exp-progress-bar');
    const daysElapsedText = document.getElementById('exp-days-elapsed-text');
    const daysRemainingText = document.getElementById('exp-days-remaining-text');
    const completeText = document.getElementById('exp-complete-text');
    const startDateText = document.getElementById('progress-start-date');
    const endDateText = document.getElementById('progress-end-date');

    if (!progressBar || !daysElapsedText || !daysRemainingText || !completeText || !startDateText || !endDateText) return;

    const currentDays = challenge.simulation.timeline.currentRuntimeDays;
    const totalDays = challenge.experiment.requiredRuntimeDays;
    const progress = (currentDays / totalDays) * 100;

    // Update progress bar width
    progressBar.style.width = `${progress}%`;

    // Update text displays
    daysElapsedText.textContent = `${currentDays} days`;
    daysRemainingText.textContent = `${totalDays - currentDays} days remaining`;

    // Show/hide complete text
    if (currentDays >= totalDays) {
        daysElapsedText.classList.add('hidden');
        completeText.classList.remove('hidden');
        completeText.textContent = `Experiment Complete (${totalDays} days)`;
        daysRemainingText.textContent = '';
    } else {
        daysElapsedText.classList.remove('hidden');
        completeText.classList.add('hidden');
    }

    // Update date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - currentDays);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (totalDays - currentDays));

    startDateText.textContent = startDate.toLocaleDateString();
    endDateText.textContent = endDate.toLocaleDateString();
}