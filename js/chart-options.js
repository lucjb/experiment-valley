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
            },
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

// Helper function for formatting percentages
function formatPercent(value) {
    const percentage = value * 100;
    return percentage.toFixed(2) + '%';
} 