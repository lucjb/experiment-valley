// Chart options configuration
const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            display: false
        },
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
            filter: function (tooltipItem) {
                // Only show tooltips for main data lines (not CI bounds)
                return !tooltipItem.dataset.isCI;
            }
        }
    }
};

// Common tooltip callbacks
const commonTooltipCallbacks = {
    title: function (context) {
        if (context.length === 0) return '';
        return context[0].label;
    }
};

// Helper function for formatting percentages
function formatPercent(value) {
    const percentage = value * 100;
    return percentage.toFixed(2) + '%';
}

// Helper function to calculate confidence level
function calculateConfidenceLevel(alpha) {
    return ((1 - alpha) * 100).toFixed(0);
}

// Helper function to get metrics from a timePoint
function getMetrics(timePoint, type, isCumulative = false) {
    if (!timePoint || !timePoint[type]) return null;
    
    const data = timePoint[type];
    return {
        rate: isCumulative ? data.cumulativeRate : data.rate,
        ci: isCumulative ? data.cumulativeRateCI : data.rateCI,
        visitors: isCumulative ? data.cumulativeVisitors : data.visitors,
        conversions: isCumulative ? data.cumulativeConversions : data.conversions
    };
}

// Conversion chart specific options
const conversionChartOptions = {
    ...chartOptions,
    plugins: {
        ...chartOptions.plugins,
        tooltip: {
            ...chartOptions.plugins.tooltip,
            callbacks: {
                ...commonTooltipCallbacks,
                label: function (context) {
                    // Skip CI datasets
                    if (context.dataset.isCI) return null;

                    const timePoint = ChartManager.completeTimeline[context.dataIndex];
                    const isBase = context.dataset.label.toLowerCase().includes('base');
                    const isCumulative = context.dataset.label.toLowerCase().includes('cumulative');
                    const type = isBase ? 'base' : 'variant';
                    
                    const metrics = getMetrics(timePoint, type, isCumulative);
                    if (!metrics) return null;

                    const confidenceLevel = calculateConfidenceLevel(ChartManager.challenge.experiment.alpha);
                    const lines = [
                        `${isBase ? 'Base' : 'Test'} Metrics:`,
                        `Rate: ${formatPercent(metrics.rate)}`
                    ];

                    // Only add CI if it exists and has valid values
                    if (metrics.ci && metrics.ci[0] !== null && metrics.ci[1] !== null) {
                        lines.push(`${confidenceLevel}% CI: [${formatPercent(metrics.ci[0])}, ${formatPercent(metrics.ci[1])}]`);
                    }

                    // Only add visitors and conversions if they exist
                    if (metrics.visitors !== null) {
                        lines.push(`Visitors: ${metrics.visitors.toLocaleString()}`);
                    }
                    if (metrics.conversions !== null) {
                        lines.push(`Conversions: ${metrics.conversions.toLocaleString()}`);
                    }

                    return lines;
                }
            }
        }
    }
};

// Visitors chart specific options
const visitorsChartOptions = {
    ...chartOptions,
    plugins: {
        ...chartOptions.plugins,
        tooltip: {
            ...chartOptions.plugins.tooltip,
            callbacks: {
                ...commonTooltipCallbacks,
                label: function (context) {
                    const timePoint = ChartManager.completeTimeline[context.dataIndex];
                    const isBase = context.dataset.label.toLowerCase().includes('base');
                    const isCumulative = this.chart.data.viewType === 'cumulative';
                    const type = isBase ? 'base' : 'variant';
                    
                    const metrics = getMetrics(timePoint, type, isCumulative);
                    if (!metrics) return null;

                    const lines = [`${isBase ? 'Base' : 'Test'} Metrics:`];
                    if (metrics.visitors !== null) {
                        lines.push(`Visitors: ${metrics.visitors.toLocaleString()}`);
                    }

                    // Add 50% target line to tooltip
                    const periodType = timePoint.period.type;
                    const multiplier = periodType === 'day' ? 1 : periodType === 'week' ? 7 : 28;
                    const targetVisitors = this.chart.data.targetVisitors * multiplier;
                    lines.push(`Expected: ${(targetVisitors / 2).toLocaleString()}`);

                    return lines;
                }
            }
        },
        annotation: {
            annotations: {
                halfVisitors: {
                    type: 'line',
                    yMin: function(context) {
                        const timePoint = ChartManager.completeTimeline[0];
                        if (!timePoint) return 0;
                        
                        const periodType = timePoint.period.type;
                        const multiplier = periodType === 'day' ? 1 : periodType === 'week' ? 7 : 28;
                        const isCumulative = context.chart.data.viewType === 'cumulative';
                        
                        if (isCumulative) {
                            // For cumulative view, start at target/2
                            const dailyTarget = context.chart.data.targetVisitors;
                            return dailyTarget / 2;
                        }
                        return (context.chart.data.targetVisitors * multiplier) / 2;
                    },
                    yMax: function(context) {
                        const timePoint = ChartManager.completeTimeline[0];
                        if (!timePoint) return 0;
                        
                        const periodType = timePoint.period.type;
                        const multiplier = periodType === 'day' ? 1 : periodType === 'week' ? 7 : 28;
                        const isCumulative = context.chart.data.viewType === 'cumulative';
                        
                        if (isCumulative) {
                            // For cumulative view, calculate total based on period type
                            const dailyTarget = context.chart.data.targetVisitors;
                            const currentIndex = context.chart.data.labels.length - 1;
                            let totalDays = 0;
                            
                            // Sum up the days for each period up to current point
                            for (let i = 0; i <= currentIndex; i++) {
                                const point = ChartManager.completeTimeline[i];
                                if (point) {
                                    const pointMultiplier = point.period.type === 'day' ? 1 : 
                                                          point.period.type === 'week' ? 7 : 28;
                                    totalDays += pointMultiplier;
                                }
                            }
                            return (dailyTarget * totalDays) / 2;
                        }
                        return (context.chart.data.targetVisitors * multiplier) / 2;
                    },
                    borderColor: '#f97316',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    label: {
                        content: function(context) {
                            const isCumulative = context.chart.data.viewType === 'cumulative';
                            return isCumulative ? 'Expected Cumulative' : 'Expected Daily';
                        },
                        enabled: true,
                        position: 'start',
                        color: '#f97316'
                    }
                }
            }
        }
    },
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

// Difference chart specific options
const differenceChartOptions = {
    ...chartOptions,
    plugins: {
        ...chartOptions.plugins,
        tooltip: {
            ...chartOptions.plugins.tooltip,
            callbacks: {
                ...commonTooltipCallbacks,
                label: function (context) {
                    const timePoint = ChartManager.completeTimeline[context.dataIndex];
                    if (!timePoint) return null;

                    const isCumulative = this.chart.data.viewType === 'cumulative';
                    const isUplift = this.chart.data.diffType === 'uplift';
                    
                    const baseMetrics = getMetrics(timePoint, 'base', isCumulative);
                    const variantMetrics = getMetrics(timePoint, 'variant', isCumulative);
                    if (!baseMetrics || !variantMetrics) return null;

                    if (context.datasetIndex === 0) {
                        const diffData = isUplift ? timePoint.uplift : timePoint.difference;
                        if (!diffData) return null;

                        const diffCI = isCumulative ? diffData.cumulativeRateCI : diffData.rateCI;
                        const diffValue = isCumulative ? diffData.cumulativeRate : diffData.rate;
                        const diffLabel = isUplift ? 'Uplift' : 'Difference';
                        const confidenceLevel = calculateConfidenceLevel(ChartManager.challenge.experiment.alpha);

                        const lines = [
                            `Base: ${formatPercent(baseMetrics.rate)} (${baseMetrics.visitors.toLocaleString()} visitors)`,
                            `Variant: ${formatPercent(variantMetrics.rate)} (${variantMetrics.visitors.toLocaleString()} visitors)`,
                            `${diffLabel}: ${formatPercent(diffValue)}`
                        ];

                        // Only add CI if it exists and has valid values
                        if (diffCI && diffCI[0] !== null && diffCI[1] !== null) {
                            lines.push(`${confidenceLevel}% CI: [${formatPercent(diffCI[0])}, ${formatPercent(diffCI[1])}]`);
                        }

                        return lines;
                    }
                    return null;
                }
            }
        }
    }
};

// Export only the chart-specific options
window.conversionChartOptions = conversionChartOptions;
window.visitorsChartOptions = visitorsChartOptions;
window.differenceChartOptions = differenceChartOptions; 