// Color configuration
const Colors = {
    // Base colors
    base: {
        primary: 'rgb(147, 51, 234)',    // Purple
        secondary: 'rgb(107, 11, 194)',   // Dark purple
        ci: 'rgba(147, 51, 234, 0.1)',    // Light purple for CI
        future: 'rgb(128, 128, 128)',     // Gray for future data
        futureCI: 'rgba(128, 128, 128, 0.1)' // Semi-transparent gray for future CI
    },
    // Variant colors
    variant: {
        primary: 'rgb(59, 130, 246)',     // Blue
        secondary: 'rgb(19, 90, 206)',    // Dark blue
        ci: 'rgba(59, 130, 246, 0.1)',    // Light blue for CI
        future: 'rgb(192, 192, 192)',     // Light gray for future data
        futureCI: 'rgba(192, 192, 192, 0.1)' // Semi-transparent light gray for future CI
    },
    // Difference/Uplift colors
    difference: {
        primary: 'rgb(59, 130, 246)',     // Blue
        secondary: 'rgb(19, 90, 206)',    // Dark blue
        ci: 'rgba(59, 130, 246, 0.1)',    // Light blue for CI
        future: 'rgb(128, 128, 128)',     // Gray for future data
        futureCI: 'rgba(128, 128, 128, 0.1)' // Semi-transparent gray for future CI

    },
    uplift: {
        primary: 'rgb(16, 185, 129)',     // Green
        secondary: 'rgb(5, 150, 105)',    // Dark green
        ci: 'rgba(16, 185, 129, 0.1)',    // Light green for CI
        future: 'rgb(128, 128, 128)',     // Gray for future data
        futureCI: 'rgba(128, 128, 128, 0.1)' // Semi-transparent gray for future CI
    },

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
            // First remove hidden class
            modal.classList.remove('hidden');
            // Force a reflow to ensure the browser processes the removal of hidden
            modal.offsetHeight;
            // Then add fade-in class
            modal.classList.add('fade-in');
        }
    },

    hide(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('fade-out', 'fade-in');
        }
    },

    showFeedback(correct, message) {
        const modal = document.getElementById(this.modals.feedback);
        if (!modal) return;

        const icon = document.getElementById('feedback-icon');
        const title = document.getElementById('feedback-title');
        const colors = correct ? {
            icon: 'bg-green-100',
            iconColor: 'text-green-600',
            title: 'text-green-900',
            text: 'Correct!'
        } : {
            icon: 'bg-red-100',
            iconColor: 'text-red-600',
            title: 'text-red-900',
            text: 'Incorrect'
        };

        icon.className = `mx-auto flex items-center justify-center h-12 w-12 rounded-full ${colors.icon}`;
        icon.innerHTML = `<svg class="h-6 w-6 ${colors.iconColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${correct ? 'M5 13l4 4L19 7' : 'M6 18L18 6M6 6l12 12'}"></path></svg>`;
        title.textContent = colors.text;
        title.className = `text-lg leading-6 font-medium ${colors.title} mt-4`;

        document.getElementById('feedback-message').innerHTML = message;
        this.show(this.modals.feedback);
    },

    showCompletion(score, accuracy) {
        document.getElementById('final-score').textContent = score;
        document.getElementById('final-accuracy').textContent = `${accuracy}%`;
        this.show(this.modals.completion);
    }
};

// Helper function to handle view toggle changes
function handleViewToggleChange(chartId, viewType, createDatasets, updateOptions) {
    const datasets = createDatasets(viewType);
    ChartManager.updateChart(chartId, {
        labels: ChartManager.createTimelineLabels(ChartManager.challenge.simulation.timeline, ChartManager.completeTimeline),
        datasets,
        viewType
    }, updateOptions(viewType, datasets));
}

// Helper function to handle difference chart updates
function handleDifferenceChartUpdate(viewType, diffType, createDatasets) {
    const datasets = createDatasets(viewType, diffType);
    const yAxisTitle = diffType === 'uplift' ? 'Uplift (%)' : 'Rate Difference (%)';

    ChartManager.updateChart('difference-chart', {
        labels: ChartManager.createTimelineLabels(ChartManager.challenge.simulation.timeline, ChartManager.completeTimeline),
        datasets,
        viewType,
        diffType
    }, {
        ...differenceChartOptions,
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
        }
    });
}

// Define the renderChart function before it's used
function renderChart(challenge, labels) {
    try {
        const timelineData = challenge.simulation.timeline;

        // Create datasets based on the view type
        function createDatasets(viewType) {
            const isCumulative = (viewType === 'cumulative');
            const datasets = [
                ChartManager.createRateDataset('base', isCumulative),
                ...ChartManager.createCIDatasets('base', isCumulative),
                ChartManager.createRateDataset('variant', isCumulative),
                ...ChartManager.createCIDatasets('variant', isCumulative)
            ];

            datasets.yAxisRange = calculateYAxisRange(datasets);
            return datasets;
        }

        function updateOptions(viewType, datasets) {
            return {
                ...conversionChartOptions,
                plugins: {
                    ...conversionChartOptions.plugins,
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
                            callback: function (value) {
                                return formatPercent(value);
                            }
                        }
                    }
                }
            };
        }

        // Initialize chart with daily view
        const datasets = createDatasets('daily');
        const chart = ChartManager.createChart('conversion-chart', 'line', {
            labels,
            datasets,
            viewType: 'daily'
        }, updateOptions('daily', datasets));

        // Add view toggle functionality
        const viewToggle = document.getElementById('chart-view-toggle');
        if (viewToggle) {
            viewToggle.options[0].text = `${timelineData.timePeriod.charAt(0).toUpperCase() + timelineData.timePeriod.slice(1)}ly View`;
            viewToggle.addEventListener('change', function (e) {
                handleViewToggleChange('conversion-chart', e.target.value, createDatasets, updateOptions);
            });
        }

        return chart;
    } catch (error) {
        console.error('Error rendering chart:', error);
        showChartError(error);
        return null;
    }
}

// Helper function to calculate y-axis range
function calculateYAxisRange(datasets) {
    let min = Infinity;
    let max = -Infinity;

    // Calculate min and max from all datasets, including CI bounds
    datasets.forEach(dataset => {
        dataset.data.forEach(value => {
            if (value !== null) {
                min = Math.min(min, value);
                max = Math.max(max, value);
            }
        });
    });

    // Add padding to the range
    const padding = (max - min) * 0.1;
    min = Math.max(0, min - padding);
    max = max + padding;

    return { min, max };
}

function renderVisitorsChart(challenge, labels) {
    try {
        const timelineData = challenge.simulation.timeline;

        // Create datasets based on view type
        function createDatasets(viewType) {
            const isCumulative = (viewType === 'cumulative');
            return [
                ChartManager.createVisitorsDataset('base', isCumulative),
                ChartManager.createVisitorsDataset('variant', isCumulative)
            ];
        }

        function updateOptions() {
            return {
                ...visitorsChartOptions,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function (value) {
                                return value.toLocaleString();
                            }
                        }
                    }
                }
            };
        }

        // Initialize chart with daily view
        const chart = ChartManager.createChart('visitors-chart', 'line', {
            labels,
            datasets: createDatasets('daily'),
            viewType: 'daily',
            targetVisitors: challenge.experiment.visitorsPerDay
        }, updateOptions());

        // Add view toggle functionality
        const viewToggle = document.getElementById('visitors-view-toggle');
        if (viewToggle) {
            viewToggle.options[0].text = `${timelineData.timePeriod.charAt(0).toUpperCase() + timelineData.timePeriod.slice(1)}ly View`;
            viewToggle.addEventListener('change', function (e) {
                handleViewToggleChange('visitors-chart', e.target.value, createDatasets, updateOptions);
            });
        }

        return chart;
    } catch (error) {
        console.error('Error rendering visitors chart:', error);
        return null;
    }
}

function renderDifferenceChart(challenge, labels) {
    try {
        const timelineData = challenge.simulation.timeline;

        // Create datasets based on view type and difference type
        function createDatasets(viewType, diffType) {
            const isUplift = diffType === 'uplift';
            const colors = isUplift ? Colors.uplift : Colors.difference;
            const isCumulative = viewType === 'cumulative';
            const dataKey = isCumulative ? 'cumulativeRate' : 'rate';
            const colorKey = isCumulative ? 'secondary' : 'primary';
            const labelPrefix = isUplift ? (isCumulative ? 'Cumulative Uplift' : 'Uplift') :
                (isCumulative ? 'Cumulative Rate Difference' : 'Rate Difference');

            const baseDataset = {
                label: labelPrefix,
                data: ChartManager.completeTimeline.map(d => {
                    if (!d[diffType] || d[diffType][dataKey] === null) return null;
                    return d[diffType][dataKey] * 100;
                }),
                borderColor: colors[colorKey],
                backgroundColor: colors[colorKey],
                ...ChartManager.createPointStyles(
                    colors[colorKey],
                    timelineData.lastFullBusinessCycleIndex
                ),
                fill: false,
                tension: 0.4,
                spanGaps: true
            };

            const datasets = [baseDataset, ...ChartManager.createCIDatasets(diffType, isCumulative, true)];

            if (isCumulative) {
                baseDataset.borderDash = [5, 5];
            }

            return datasets;
        }

        // Initialize chart with daily view and absolute difference
        const chart = ChartManager.createChart('difference-chart', 'line', {
            labels,
            datasets: createDatasets('daily', 'difference'),
            viewType: 'daily',
            diffType: 'difference'
        }, {
            ...differenceChartOptions,
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
            }
        });

        // Add view toggle functionality
        const viewToggle = document.getElementById('difference-view-toggle');
        const diffTypeToggle = document.getElementById('difference-type-toggle');

        if (viewToggle) {
            viewToggle.options[0].text = `${timelineData.timePeriod.charAt(0).toUpperCase() + timelineData.timePeriod.slice(1)}ly View`;
            viewToggle.addEventListener('change', function (e) {
                const viewType = e.target.value;
                const diffType = diffTypeToggle ? diffTypeToggle.value : 'difference';
                handleDifferenceChartUpdate(viewType, diffType, createDatasets);
            });
        }

        if (diffTypeToggle) {
            diffTypeToggle.addEventListener('change', function (e) {
                const diffType = e.target.value;
                const viewType = viewToggle ? viewToggle.value : 'daily';
                handleDifferenceChartUpdate(viewType, diffType, createDatasets);
            });
        }

        return chart;
    } catch (error) {
        console.error('Error rendering difference chart:', error);
        return null;
    }
}

function initializeCharts(challenge) {
    ChartManager.initialize(challenge);
}

// Chart Management
const ChartManager = {
    charts: {},
    challenge: null,
    completeTimeline: null,

    initialize(challenge) {
        this.challenge = challenge;
        this.resetViewToggles();
        this.cleanupExistingCharts();

        // Compute timeline data once
        const timelineData = challenge.simulation.timeline;
        const totalDays = challenge.experiment.requiredRuntimeDays;
        this.completeTimeline = this.generateCompleteTimeline(timelineData, totalDays);

        this.renderAllCharts();
    },

    resetViewToggles() {
        const toggles = ['chart-view-toggle', 'visitors-view-toggle', 'difference-view-toggle'];
        toggles.forEach(toggleId => {
            const toggle = document.getElementById(toggleId);
            if (toggle) {
                toggle.value = 'daily';
            }
        });
    },

    cleanupExistingCharts() {
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
        this.destroyAllCharts();
    },

    renderAllCharts() {
        const labels = this.createTimelineLabels(this.challenge.simulation.timeline, this.completeTimeline);
        renderChart(this.challenge, labels);
        renderVisitorsChart(this.challenge, labels);
        renderDifferenceChart(this.challenge, labels);
    },

    // Helper function to create a base dataset
    createBaseDataset(type, dataKey, labelSuffix, isCumulative = false) {
        const colors =  Colors[type];
        const colorKey = isCumulative ? 'secondary' : 'primary';
        const timelineData = this.challenge.simulation.timeline;

        const mapData = (d) => {
            const value = d[type][dataKey];
            return value != null ? (typeof value === 'number' ? Number(value.toFixed(4)) : value) : null;
        };

        return {
            label: this.createDatasetLabel(type, timelineData.timePeriod, labelSuffix, isCumulative),
            data: this.completeTimeline.map(mapData),
            borderColor: colors[colorKey],
            backgroundColor: colors[colorKey],
            ...this.createPointStyles(colors[colorKey], timelineData.lastFullBusinessCycleIndex, type),
            ...(isCumulative ? { borderDash: [5, 5] } : {}),
            fill: false,
            tension: 0.4,
            spanGaps: true
        };
    },

    // Helper function to create dataset label
    createDatasetLabel(type, timePeriod, labelSuffix, isCumulative) {
        const labelConfig = {
            base: {
                name: 'Base',
                daily: `${timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1)}ly`,
                cumulative: 'Cumulative'
            },
            variant: {
                name: 'Variant',
                daily: `${timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1)}ly`,
                cumulative: 'Cumulative'
            }
        };

        const config = labelConfig[type];
        const viewType = isCumulative ? 'cumulative' : 'daily';
        
        return `${config[viewType]} ${config.name} ${labelSuffix}`;
    },

    // Helper function to create a rate dataset
    createRateDataset(type, isCumulative = false) {
        const dataKey = isCumulative ? 'cumulativeRate' : 'rate';
        return this.createBaseDataset(type, dataKey, 'Rate', isCumulative);
    },

    // Helper function to create a visitors dataset
    createVisitorsDataset(type, isCumulative = false) {
        const dataKey = isCumulative ? 'cumulativeVisitors' : 'visitors';
        return this.createBaseDataset(type, dataKey, 'Visitors', isCumulative);
    },

    // Helper function to create CI datasets
    createCIDatasets(type, isCumulative = false, isPercentage = false) {
        const colors = Colors[type];
        const dataKey = isCumulative ? 'cumulativeRateCI' : 'rateCI';
        const rateKey = isCumulative ? 'cumulativeRate' : 'rate';
        const labelPrefix = isCumulative ? 'Cumulative ' : '';
        const multiplier = isPercentage ? 100 : 1;
        const timelineData = this.challenge.simulation.timeline;

        const mapCIData = (index) => this.completeTimeline.map(d => {
            if (!d[type] || d[type][dataKey] === null || d[type][rateKey] === null) return null;
            return d[type][dataKey][index] * multiplier;
        });

        const baseCIDataset = {
            borderColor: 'transparent',
            backgroundColor: colors.ci,
            segment: {
                backgroundColor: (ctx) => ctx.p0DataIndex >= timelineData.lastFullBusinessCycleIndex ? colors.futureCI : colors.ci,
            },
            tension: 0.4,
            spanGaps: true,
            isCI: true
        };

        const datasets = [
            {
                ...baseCIDataset,
                label: `${labelPrefix}CI Upper`,
                data: mapCIData(1),
                fill: '+1'
            },
            {
                ...baseCIDataset,
                label: `${labelPrefix}CI Lower`,
                data: mapCIData(0),
                fill: false
            }
        ];

        return datasets;
    },

    // Helper function to create point styles
    createPointStyles(color, lastFullBusinessCycleIndex, type = 'variant') {
        console.log('lastFullBusinessCycleIndex', lastFullBusinessCycleIndex);
        const futureColor = Colors[type].future;
        return {
            pointBackgroundColor: this.completeTimeline.map((_, i) => i > lastFullBusinessCycleIndex ? futureColor : color),
            pointBorderColor: this.completeTimeline.map((_, i) => i > lastFullBusinessCycleIndex ? futureColor : color),
            segment: {
                borderColor: (ctx) => ctx.p0DataIndex >= lastFullBusinessCycleIndex ? futureColor : color,
                backgroundColor: (ctx) => ctx.p0DataIndex >= lastFullBusinessCycleIndex ? futureColor : color
            }
        };
    },

    // Helper function to create timeline labels
    createTimelineLabels(timelineData, completeTimeline) {
        const periodConfig = {
            day: {
                label: (startDay) => `Day ${startDay}`,
                divisor: 1
            },
            week: {
                label: (startDay) => `Week ${Math.ceil(startDay / 7)}`,
                divisor: 7
            },
            month: {
                label: (startDay) => `Month ${Math.ceil(startDay / 28)}`,
                divisor: 28
            }
        };

        return completeTimeline.map((point, index) => {
            const { type, startDay } = point.period;
            const config = periodConfig[type];
            const label = config.label(startDay);
            return index === timelineData.lastFullBusinessCycleIndex ? `[${label}]` : label;
        });
    },

    // Helper function to generate complete timeline
    generateCompleteTimeline(timelineData, totalDays) {
        console.log('timelineData', timelineData);
        const timePoints = timelineData.timePoints;
        const completeTimeline = [...timePoints];
        const currentDays = timelineData.currentRuntimeDays;

        if (currentDays < totalDays) {
            const lastPoint = timePoints[timePoints.length - 1];
            const { type } = lastPoint.period;
            const periodLength = type === 'day' ? 1 : type === 'week' ? 7 : 28;
            let nextDay = lastPoint.period.startDay + periodLength;

            const createEmptyTimelinePoint = (startDay) => ({
                period: { type, startDay },
                base: this.createEmptyMetrics(),
                variant: this.createEmptyMetrics(),
                difference: this.createEmptyMetrics(),
                uplift: this.createEmptyMetrics()
            });

            while (nextDay <= totalDays) {
                completeTimeline.push(createEmptyTimelinePoint(nextDay));
                nextDay += periodLength;
            }
        }

        return completeTimeline;
    },

    // Helper function to create empty metrics
    createEmptyMetrics() {
        return {
            rate: null,
            rateCI: [null, null],
            visitors: null,
            conversions: null,
            cumulativeRate: null,
            cumulativeRateCI: [null, null],
            cumulativeVisitors: null
        };
    },


    createChart(canvasId, type, data, options) {
        const canvas = document.getElementById(canvasId);

        // Destroy existing chart if it exists
        this.destroyChart(canvasId);

        // Create new chart with merged options
        this.charts[canvasId] = new Chart(canvas, {
            type,
            data,
            options: this.mergeChartOptions(options, data.viewType)
        });

        return this.charts[canvasId];
    },

    updateChart(canvasId, newData, newOptions = {}) {
        const chart = this.charts[canvasId];
        if (!chart) {
            console.warn(`Chart ${canvasId} not found`);
            return;
        }

        // Update the entire data object
        chart.data = {
            ...chart.data,
            ...newData
        };

        // Update options while preserving animations and tooltips
        chart.options = this.mergeChartOptions(
            newOptions,
            newData.viewType,
            chart.options.animation,
            chart.options.plugins.tooltip.callbacks
        );

        chart.update('none'); // Update without animation for better performance
    },

    // Helper function to merge chart options
    mergeChartOptions(newOptions, viewType, animation = null, tooltipCallbacks = null) {
        return {
            ...newOptions,
            animation: animation || newOptions.animation,
            plugins: {
                ...newOptions.plugins,
                tooltip: {
                    ...newOptions.plugins?.tooltip,
                    viewType: viewType || 'daily',
                    callbacks: tooltipCallbacks || newOptions.plugins?.tooltip?.callbacks || {}
                }
            }
        };
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
    },
};

// Add resize handler
window.addEventListener('resize', () => ChartManager.resizeCharts());