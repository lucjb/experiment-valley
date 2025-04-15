// Color mappings for confidence intervals
const CIColorMappings = {
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
    },
    base: {
        bar: 'bg-purple-200',
        marker: 'bg-purple-600',
        text: 'text-purple-900'
    }
};

// Helper function to convert actual values to view percentages
function toViewPercent(value, viewMin, viewMax) {
    return ((value - viewMin) / (viewMax - viewMin)) * 100;
}

// Helper function to update CI visualization
function updateCIVisualization(containerId, low, high, mean, colorSet, showBounds = true, viewMin, viewMax) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Get elements
    const rangeBar = container.querySelector('div:nth-child(1)');
    const marker = container.querySelector('div:nth-child(2)');
    const lowLabel = document.getElementById(`${containerId}-low`);
    const highLabel = document.getElementById(`${containerId}-high`);

    // Calculate positions
    const lowPercent = toViewPercent(low, viewMin, viewMax);
    const highPercent = toViewPercent(high, viewMin, viewMax);
    const meanPercent = toViewPercent(mean, viewMin, viewMax);

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
            const value = key === 'min' ? viewMin : viewMax;

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

    // Update base CI (always purple)
    updateCIVisualization(
        'base-ci',
        challenge.simulation.confidenceIntervalBase[0],
        challenge.simulation.confidenceIntervalBase[1],
        challenge.simulation.actualBaseConversionRate,
        CIColorMappings.base,
        true,
        conversionViewMin,
        conversionViewMax
    );

    // Update variant CI with result-based colors
    updateCIVisualization(
        'variant-ci',
        challenge.simulation.confidenceIntervalVariant[0],
        challenge.simulation.confidenceIntervalVariant[1],
        challenge.simulation.variantConversionRate,
        CIColorMappings[resultType],
        true,
        conversionViewMin,
        conversionViewMax
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
        const colors = CIColorMappings[resultType];

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

// Helper function for calculating confidence level
function calculateConfidenceLevel(alpha) {
    return ((1 - alpha) * 100).toFixed(0);
}

// Helper function for formatting percentages
function formatPercent(value) {
    const percentage = value * 100;
    return percentage.toFixed(2) + '%';
}

// Export the functions
window.updateConfidenceIntervals = updateConfidenceIntervals; 