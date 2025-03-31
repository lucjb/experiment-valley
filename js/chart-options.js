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

// Conversion chart specific options
const conversionChartOptions = {
    ...chartOptions,
    plugins: {
        ...chartOptions.plugins,
        tooltip: {
            ...chartOptions.plugins.tooltip,
            callbacks: {
                title: function (context) {
                    if (context.length === 0) return '';
                    return context[0].label;
                },
                label: function (context) {
                    // Skip CI datasets
                    if (context.dataset.isCI) return null;

                    const timePoint = window.completeTimeline[context.dataIndex];
                    const isBase = context.dataset.label.toLowerCase().includes('base');
                    const isCumulative = context.dataset.label.toLowerCase().includes('cumulative');
                    const data = isBase ? timePoint.base : timePoint.variant;

                    if (!data) return null;

                    // Get the appropriate metrics based on view type
                    const rate = isCumulative ? data.cumulativeRate : data.rate;
                    const ci = isCumulative ? data.cumulativeRateCI : data.rateCI;
                    const visitors = isCumulative ? data.cumulativeVisitors : data.visitors;
                    const conversions = isCumulative ? data.cumulativeConversions : data.conversions;
                    const confidenceLevel = this.chart.data.confidenceLevel;

                    // Format the tooltip lines
                    const lines = [
                        `${isBase ? 'Base' : 'Test'} Metrics:`,
                        `Rate: ${formatPercent(rate)}`
                    ];

                    // Only add CI if it exists and has valid values
                    if (ci && ci[0] !== null && ci[1] !== null) {
                        lines.push(`${confidenceLevel}% CI: [${formatPercent(ci[0])}, ${formatPercent(ci[1])}]`);
                    }

                    // Only add visitors and conversions if they exist
                    if (visitors !== null) {
                        lines.push(`Visitors: ${visitors.toLocaleString()}`);
                    }
                    if (conversions !== null) {
                        lines.push(`Conversions: ${conversions.toLocaleString()}`);
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
            viewType: 'daily',
            callbacks: {
                title: function (context) {
                    if (context.length === 0) return '';
                    return context[0].label;
                },
                label: function (context) {
                    const timePoint = window.completeTimeline[context.dataIndex];
                    if (!timePoint) return null;

                    const isCumulative = this.chart.options.plugins.tooltip.viewType === 'cumulative';
                    const isBase = context.dataset.label.toLowerCase().includes('base');
                    const data = isBase ? timePoint.base : timePoint.variant;

                    if (!data) return null;

                    // Get the appropriate metrics based on view type
                    const visitors = isCumulative ? data.cumulativeVisitors : data.visitors;

                    // Format the tooltip lines
                    const lines = [
                        `${isBase ? 'Base' : 'Test'} Metrics:`
                    ];

                    // Only add visitors if they exist
                    if (visitors !== null) {
                        lines.push(`Visitors: ${visitors.toLocaleString()}`);
                    }

                    return lines;
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
            viewType: 'daily',
            diffType: 'difference',
            callbacks: {
                title: function (context) {
                    if (context.length === 0) return '';
                    return context[0].label;
                },
                label: function (context) {
                    const timePoint = window.completeTimeline[context.dataIndex];
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
                        if (!diffData) return null;

                        const diffCI = isCumulative ? diffData.cumulativeRateCI : diffData.rateCI;
                        const diffValue = isCumulative ? diffData.cumulativeRate : diffData.rate;
                        const diffLabel = isUplift ? 'Uplift' : 'Difference';
                        const confidenceLevel = this.chart.data.confidenceLevel;

                        const lines = [
                            `Base: ${formatPercent(baseRate)} (${baseVisitors.toLocaleString()} visitors)`,
                            `Variant: ${formatPercent(variantRate)} (${variantVisitors.toLocaleString()} visitors)`,
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

// Helper function for formatting percentages
function formatPercent(value) {
    const percentage = value * 100;
    return percentage.toFixed(2) + '%';
}

// Export only the chart-specific options
window.conversionChartOptions = conversionChartOptions;
window.visitorsChartOptions = visitorsChartOptions;
window.differenceChartOptions = differenceChartOptions; 