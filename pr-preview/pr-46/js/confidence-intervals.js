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
    const rawLowPercent = toViewPercent(low, viewMin, viewMax);
    const rawHighPercent = toViewPercent(high, viewMin, viewMax);

    // Base clamp to avoid overflow on the edges
    const clamp = (val) => Math.min(Math.max(val, 2), 98);

    // Gaps and thresholds (in percentage points)
    const outwardGap = 2;       // gap when placing labels outside the bar
    const innerGap = 2;         // gap when placing labels inside the bar
    const edgeThreshold = 8;    // near-edge zone to avoid overlapping scale labels (which sit at ~2% and 98%)
    const minSeparation = 10;   // ensure labels never overlap (wider to account for text width)
    const narrowThreshold = 10; // CI width below which we try outside placement

    // Determine narrow vs wide CI
    const ciWidth = Math.abs(rawHighPercent - rawLowPercent);
    const isNarrow = ciWidth < narrowThreshold;

    // Decide placement per bound with edge-aware logic
    let lowLabelPos;
    if (isNarrow) {
        // Prefer outside-left; if too close to left edge, place inside-right
        if (rawLowPercent < edgeThreshold) {
            lowLabelPos = clamp(rawLowPercent + innerGap);
        } else {
            lowLabelPos = clamp(rawLowPercent - outwardGap);
        }
    } else {
        // Wide: place inside-right of the bar start
        lowLabelPos = clamp(rawLowPercent + innerGap);
    }

    let highLabelPos;
    if (isNarrow) {
        // Prefer outside-right; if too close to right edge, place inside-left
        if (rawHighPercent > 100 - edgeThreshold) {
            highLabelPos = clamp(rawHighPercent - innerGap);
        } else {
            highLabelPos = clamp(rawHighPercent + outwardGap);
        }
    } else {
        // Wide: place inside-left of the bar end
        highLabelPos = clamp(rawHighPercent - innerGap);
    }

    // Ensure minimum separation between labels
    if (highLabelPos - lowLabelPos < minSeparation) {
        // Spread around the midpoint while respecting edges
        const mid = Math.min(Math.max((lowLabelPos + highLabelPos) / 2, 2 + minSeparation / 2), 98 - minSeparation / 2);
        lowLabelPos = clamp(mid - minSeparation / 2);
        highLabelPos = clamp(mid + minSeparation / 2);
    }

    // Also compute clamped bar edges for drawing bar/marker
    const lowPercent = clamp(rawLowPercent);
    const highPercent = clamp(rawHighPercent);
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
        lowLabel.className = `absolute text-xs font-medium transform -translate-x-1/2 -translate-y-1/2 ${colorSet.text} drop-shadow-sm top-1/2`;
        lowLabel.textContent = formatPercent(low);
        lowLabel.style.left = `${lowLabelPos}%`;
    }

    if (highLabel) {
        highLabel.className = `absolute text-xs font-medium transform -translate-x-1/2 -translate-y-1/2 ${colorSet.text} drop-shadow-sm top-1/2`;
        highLabel.textContent = formatPercent(high);
        highLabel.style.left = `${highLabelPos}%`;
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
        
        // Check for Twyman's Law: extremely low p-value AND unusually large effect size (|Δ| ≥ 2×MRE)
        const pValueString = pValue.toFixed(10);
        const suspiciousPValue = pValueString.includes('0.000000') || pValue < 0.000001;
        const absoluteDelta = Math.abs(challenge.simulation.variantConversionRate - challenge.simulation.baseConversionRate);
        const largeEffect = absoluteDelta >= 2 * challenge.experiment.minimumRelevantEffect;
        const hasTwymansLaw = suspiciousPValue && largeEffect;
        
        // Add Twyman's Law alert if detected
        if (hasTwymansLaw) {
            const message = `Twyman's Law detected: Suspiciously low p-value (p=${pValue.toFixed(10)}) and unusually large effect (more than 10 x the MRE)\n\nWhy it matters: extreme wins often point to instrumentation problems. Pause and verify the data before acting.\n\n<a href=\"twymans-law.html\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"text-blue-500 hover:text-blue-700\">Twyman's Law explainer →</a>`;
            
            // Store the original text content
            const originalText = pValueElement.textContent;
            
            // Clear the element and rebuild it with warning icon
            pValueElement.textContent = '';
            
            // Add the original text back
            const textSpan = document.createElement('span');
            textSpan.textContent = originalText;
            pValueElement.appendChild(textSpan);
            
            // Add warning icon
            const warningIcon = document.createElement('span');
            warningIcon.className = 'text-yellow-500 cursor-help tooltip-trigger text-lg font-medium ml-2';
            warningIcon.textContent = '⚠️';

            const tooltipContent = document.createElement('span');
            tooltipContent.className = 'tooltip-content';
            tooltipContent.innerHTML = message.replace(/\n/g, '<br>');
            warningIcon.appendChild(tooltipContent);

            // Initialize tooltip with consistent clickable behavior
            UIController.initializeTooltip(warningIcon);

            pValueElement.appendChild(warningIcon);
        }
    }

    // Calculate the difference in conversion rate
    const diffValue = challenge.simulation.variantConversionRate - challenge.simulation.baseConversionRate;

    // Display difference in conversion rate
    const differenceDisplay = document.getElementById('difference-display');
    if (differenceDisplay) {
        differenceDisplay.textContent = formatPercent(diffValue);
    }

    // Find the range for conversion rate intervals
    const conversionValues = [
        ...challenge.simulation.confidenceIntervalBase,
        ...challenge.simulation.confidenceIntervalVariant,
        challenge.simulation.baseConversionRate,
        challenge.simulation.variantConversionRate
    ];

    const minConversionValue = Math.min(...conversionValues);
    const maxConversionValue = Math.max(...conversionValues);
    const conversionViewRange = maxConversionValue - minConversionValue;
    const viewPadding = conversionViewRange * 0.2;

    // Round to nice intervals
    const conversionViewMin = Math.floor((minConversionValue - viewPadding) * 100) / 100;
    const conversionViewMax = Math.ceil((maxConversionValue + viewPadding) * 100) / 100;

    // Determine result type based on CI difference and improvement direction
    const lowDiff = challenge.simulation.confidenceIntervalDifference[0];
    const highDiff = challenge.simulation.confidenceIntervalDifference[1];
    const improvementDirection = challenge.experiment.improvementDirection;
    let resultType;
    
    if (improvementDirection === 'LOWER_IS_BETTER') {
        // For lower-is-better: green when variant is lower (negative difference), red when higher (positive difference)
        if (highDiff < 0) {
            resultType = 'positive'; // Good result (variant is lower)
        } else if (lowDiff > 0) {
            resultType = 'negative'; // Bad result (variant is higher)
        } else {
            resultType = 'inconclusive';
        }
    } else {
        // For higher-is-better (default): green when variant is higher (positive difference), red when lower (negative difference)
        if (lowDiff > 0) {
            resultType = 'positive';
        } else if (highDiff < 0) {
            resultType = 'negative';
        } else {
            resultType = 'inconclusive';
        }
    }

    // Update base CI (always purple)
    updateCIVisualization(
        'base-ci',
        challenge.simulation.confidenceIntervalBase[0],
        challenge.simulation.confidenceIntervalBase[1],
        challenge.simulation.baseConversionRate,
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

        // Update zero line and label first
        const zeroLine = diffContainer.querySelector('.zero-line') || document.createElement('div');
        zeroLine.className = 'zero-line absolute h-full w-px bg-gray-400';
        zeroLine.style.left = `${zeroPercent}%`;
        if (!diffContainer.querySelector('.zero-line')) {
            diffContainer.appendChild(zeroLine);
        }

        const zeroLabel = diffContainer.querySelector('.zero-label') || document.createElement('span');
        zeroLabel.className = 'zero-label absolute text-xs font-medium transform -translate-x-1/2 -translate-y-1/2 text-gray-400 top-1/2';
        zeroLabel.style.left = `${zeroPercent}%`;
        zeroLabel.textContent = '0%';
        if (!diffContainer.querySelector('.zero-label')) {
            diffContainer.appendChild(zeroLabel);
        }

        // Update labels after zero line is in place (pixel-accurate collision handling)
        if (lowLabel && highLabel) {
            const clampPct = (val) => Math.min(Math.max(val, 2), 98);
            const innerGapPct = 1.2;
            const outwardGapPx = 8; // pixels outside the bar edge
            const minGapPx = 8;      // minimal gap between label boxes

            // 1) Default: place inside near edges
            let lowCenterPct = clampPct(lowPercent + innerGapPct);
            let highCenterPct = clampPct(highPercent - innerGapPct);

            // Avoid zero label when inside
            if (Math.abs(lowCenterPct - zeroPercent) < 4) lowCenterPct = clampPct(lowCenterPct + innerGapPct);
            if (Math.abs(highCenterPct - zeroPercent) < 4) highCenterPct = clampPct(highCenterPct - innerGapPct);

            // Apply and measure
            lowLabel.className = `absolute text-xs font-medium transform -translate-x-1/2 -translate-y-1/2 ${colors.text} drop-shadow-sm top-1/2`;
            highLabel.className = `absolute text-xs font-medium transform -translate-x-1/2 -translate-y-1/2 ${colors.text} drop-shadow-sm top-1/2`;
            lowLabel.textContent = formatPercent(lowDiff);
            highLabel.textContent = formatPercent(highDiff);
            lowLabel.style.left = `${lowCenterPct}%`;
            highLabel.style.left = `${highCenterPct}%`;

            const containerWidth = diffContainer.clientWidth || 0;
            const pctToPx = (pct) => (pct / 100) * containerWidth;
            const lowWidth = lowLabel.offsetWidth || 0;
            const highWidth = highLabel.offsetWidth || 0;
            const zeroEl = diffContainer.querySelector('.zero-label');
            const zeroWidth = zeroEl ? zeroEl.offsetWidth || 0 : 0;
            const zeroCenterPx = pctToPx(zeroPercent);

            const getBox = (centerPct, widthPx) => {
                const centerPx = pctToPx(centerPct);
                return { left: centerPx - widthPx / 2, right: centerPx + widthPx / 2 };
            };

            let lowBox = getBox(lowCenterPct, lowWidth);
            let highBox = getBox(highCenterPct, highWidth);
            const zeroBox = { left: zeroCenterPx - zeroWidth / 2, right: zeroCenterPx + zeroWidth / 2 };

			const overlaps = (a, b, gapPx = minGapPx) => a.left < b.right + gapPx && b.left < a.right + gapPx;

			// 2) If labels overlap each other or zero, try nudging inward before moving outside
			if (overlaps(lowBox, highBox) || overlaps(lowBox, zeroBox, 4) || overlaps(highBox, zeroBox, 4)) {
				// Attempt gentle nudge away from zero and from each other
				let nudgedLowPct = clampPct(lowCenterPct + innerGapPct);
				let nudgedHighPct = clampPct(highCenterPct - innerGapPct);
				let nudgedLowBox = getBox(nudgedLowPct, lowWidth);
				let nudgedHighBox = getBox(nudgedHighPct, highWidth);
				if (!overlaps(nudgedLowBox, nudgedHighBox) && !overlaps(nudgedLowBox, zeroBox, 4) && !overlaps(nudgedHighBox, zeroBox, 4)) {
					lowCenterPct = nudgedLowPct;
					highCenterPct = nudgedHighPct;
					lowLabel.style.left = `${lowCenterPct}%`;
					highLabel.style.left = `${highCenterPct}%`;
				} else {
					// If still overlapping, move only the overlapping label(s) outside
					const barLeftPx = pctToPx(lowPercent);
					const barRightPx = pctToPx(highPercent);

					let newLowCenterPx = pctToPx(lowCenterPct);
					let newHighCenterPx = pctToPx(highCenterPct);

					if (overlaps(lowBox, zeroBox, 4) || overlaps(lowBox, highBox)) {
						newLowCenterPx = barLeftPx - outwardGapPx - lowWidth / 2;
					}
					if (overlaps(highBox, zeroBox, 4) || overlaps(lowBox, highBox)) {
						newHighCenterPx = barRightPx + outwardGapPx + highWidth / 2;
					}

					// Keep within container bounds
					newLowCenterPx = Math.max(lowWidth / 2, Math.min(containerWidth - lowWidth / 2, newLowCenterPx));
					newHighCenterPx = Math.max(highWidth / 2, Math.min(containerWidth - highWidth / 2, newHighCenterPx));

					// Ensure min gap between labels if both ended outside
					if (newHighCenterPx - highWidth / 2 < newLowCenterPx + lowWidth / 2 + minGapPx) {
						newHighCenterPx = newLowCenterPx + (lowWidth / 2) + (highWidth / 2) + minGapPx;
						newHighCenterPx = Math.min(newHighCenterPx, containerWidth - highWidth / 2);
					}

					lowCenterPct = (newLowCenterPx / containerWidth) * 100;
					highCenterPct = (newHighCenterPx / containerWidth) * 100;

					lowLabel.style.left = `${lowCenterPct}%`;
					highLabel.style.left = `${highCenterPct}%`;
				}
			}
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

        // Add zero line and label first
        const zeroLine = container.querySelector('.zero-line') || document.createElement('div');
        zeroLine.className = 'absolute h-full w-px bg-gray-400';
        zeroLine.style.left = `${toViewPercent(0)}%`;
        if (!container.querySelector('.zero-line')) {
            container.appendChild(zeroLine);
        }

        const zeroLabel = container.querySelector('.zero-label') || document.createElement('span');
        zeroLabel.className = 'zero-label absolute text-xs font-medium transform -translate-x-1/2 -translate-y-1/2 text-gray-400 top-1/2';
        zeroLabel.style.left = `${toViewPercent(0)}%`;
        zeroLabel.textContent = '0%';
        if (!container.querySelector('.zero-label')) {
            container.appendChild(zeroLabel);
        }

        // Update labels after zero line is in place (pixel-accurate collision handling)
        if (lowLabel && highLabel) {
            const clampPct = (val) => Math.min(Math.max(val, 2), 98);
            const innerGapPct = 1.2;
            const outwardGapPx = 8;
            const minGapPx = 8;

            const lowPct = clampPct(toViewPercent(lowUplift));
            const highPct = clampPct(toViewPercent(highUplift));
            const zeroPct = toViewPercent(0);

            // 1) Default: inside near edges
            let lowCenterPct = clampPct(lowPct + innerGapPct);
            let highCenterPct = clampPct(highPct - innerGapPct);

            if (Math.abs(lowCenterPct - zeroPct) < 4) lowCenterPct = clampPct(lowCenterPct + innerGapPct);
            if (Math.abs(highCenterPct - zeroPct) < 4) highCenterPct = clampPct(highCenterPct - innerGapPct);

            // Apply and measure
            lowLabel.className = `absolute text-xs font-medium transform -translate-x-1/2 -translate-y-1/2 ${colors.text} drop-shadow-sm top-1/2`;
            highLabel.className = `absolute text-xs font-medium transform -translate-x-1/2 -translate-y-1/2 ${colors.text} drop-shadow-sm top-1/2`;
            lowLabel.textContent = formatPercent(lowUplift);
            highLabel.textContent = formatPercent(highUplift);
            lowLabel.style.left = `${lowCenterPct}%`;
            highLabel.style.left = `${highCenterPct}%`;

            const containerWidth = container.clientWidth || 0;
            const pctToPx = (pct) => (pct / 100) * containerWidth;
            const lowWidth = lowLabel.offsetWidth || 0;
            const highWidth = highLabel.offsetWidth || 0;
            const zeroEl = container.querySelector('.zero-label');
            const zeroWidth = zeroEl ? zeroEl.offsetWidth || 0 : 0;
            const zeroCenterPx = pctToPx(zeroPct);

            const getBox = (centerPct, widthPx) => {
                const centerPx = pctToPx(centerPct);
                return { left: centerPx - widthPx / 2, right: centerPx + widthPx / 2 };
            };

            let lowBox = getBox(lowCenterPct, lowWidth);
            let highBox = getBox(highCenterPct, highWidth);
            const zeroBox = { left: zeroCenterPx - zeroWidth / 2, right: zeroCenterPx + zeroWidth / 2 };

			const overlaps = (a, b, gapPx = minGapPx) => a.left < b.right + gapPx && b.left < a.right + gapPx;

			// 2) If labels overlap each other or zero, try nudging inward before moving outside
			if (overlaps(lowBox, highBox) || overlaps(lowBox, zeroBox, 4) || overlaps(highBox, zeroBox, 4)) {
				// Attempt gentle nudge away from zero and from each other
				let nudgedLowPct = clampPct(lowCenterPct + innerGapPct);
				let nudgedHighPct = clampPct(highCenterPct - innerGapPct);
				let nudgedLowBox = getBox(nudgedLowPct, lowWidth);
				let nudgedHighBox = getBox(nudgedHighPct, highWidth);
				if (!overlaps(nudgedLowBox, nudgedHighBox) && !overlaps(nudgedLowBox, zeroBox, 4) && !overlaps(nudgedHighBox, zeroBox, 4)) {
					lowCenterPct = nudgedLowPct;
					highCenterPct = nudgedHighPct;
					lowLabel.style.left = `${lowCenterPct}%`;
					highLabel.style.left = `${highCenterPct}%`;
				} else {
					// If still overlapping, move only the overlapping label(s) outside
					const barLeftPx = pctToPx(lowPct);
					const barRightPx = pctToPx(highPct);

					let newLowCenterPx = pctToPx(lowCenterPct);
					let newHighCenterPx = pctToPx(highCenterPct);

					if (overlaps(lowBox, zeroBox, 4) || overlaps(lowBox, highBox)) {
						newLowCenterPx = barLeftPx - outwardGapPx - lowWidth / 2;
					}
					if (overlaps(highBox, zeroBox, 4) || overlaps(lowBox, highBox)) {
						newHighCenterPx = barRightPx + outwardGapPx + highWidth / 2;
					}

					// Keep within container bounds
					newLowCenterPx = Math.max(lowWidth / 2, Math.min(containerWidth - lowWidth / 2, newLowCenterPx));
					newHighCenterPx = Math.max(highWidth / 2, Math.min(containerWidth - highWidth / 2, newHighCenterPx));

					// Ensure min gap between labels if both ended outside
					if (newHighCenterPx - highWidth / 2 < newLowCenterPx + lowWidth / 2 + minGapPx) {
						newHighCenterPx = newLowCenterPx + (lowWidth / 2) + (highWidth / 2) + minGapPx;
						newHighCenterPx = Math.min(newHighCenterPx, containerWidth - highWidth / 2);
					}

					lowCenterPct = (newLowCenterPx / containerWidth) * 100;
					highCenterPct = (newHighCenterPx / containerWidth) * 100;

					lowLabel.style.left = `${lowCenterPct}%`;
					highLabel.style.left = `${highCenterPct}%`;
				}
			}
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