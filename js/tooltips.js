function initializeTooltips() {
    const tooltipContent = {
        'p-value': 'The probability of observing results at least as extreme as the current data, assuming the null hypothesis is true. Lower values indicate stronger evidence against the null hypothesis.',
        'confidence-interval': 'A range of values that is likely to contain the true population parameter. Wider intervals indicate more uncertainty.',
        'conversion-rate': 'The percentage of visitors who complete the desired action (e.g., making a purchase).',
        'minimum-relevant-effect': 'The smallest difference in conversion rates that would be practically meaningful for the business.',
        'statistical-power': 'The probability of detecting a true effect when it exists. Higher power reduces the chance of false negatives.',
        'sample-size': 'The number of visitors included in the test. Larger samples provide more reliable results but require more time or traffic.'
    };

    // Initialize tooltips using tippy.js
    tippy('[data-tooltip]', {
        content: (reference) => tooltipContent[reference.getAttribute('data-tooltip')],
        placement: 'top',
        arrow: true,
        theme: 'light',
        animation: 'scale'
    });
}

function showFeedback(correct, challenge) {
    const feedback = document.getElementById('feedback');
    feedback.classList.remove('hidden', 'bg-green-100', 'bg-red-100');
    
    const baseRate = (challenge.simulation.actualConversionsBase / challenge.simulation.actualVisitorsBase * 100).toFixed(2);
    const variantRate = (challenge.simulation.actualConversionsVariant / challenge.simulation.actualVisitorsVariant * 100).toFixed(2);
    
    if (correct) {
        feedback.classList.add('bg-green-100');
        feedback.innerHTML = `
            <div class="p-4">
                <h3 class="font-bold text-green-800 mb-2">Correct Decision! 🎉</h3>
                <p class="text-green-700">
                    The variant ${variantRate > baseRate ? 'outperformed' : 'underperformed'} the base version with:
                    <ul class="list-disc list-inside mt-2">
                        <li>Base conversion rate: ${baseRate}%</li>
                        <li>Variant conversion rate: ${variantRate}%</li>
                        <li>P-value: ${challenge.simulation.pValue.toFixed(4)}</li>
                    </ul>
                </p>
            </div>
        `;
    } else {
        feedback.classList.add('bg-red-100');
        feedback.innerHTML = `
            <div class="p-4">
                <h3 class="font-bold text-red-800 mb-2">Incorrect Decision</h3>
                <p class="text-red-700">
                    Let's analyze why:
                    <ul class="list-disc list-inside mt-2">
                        <li>Statistical significance (p-value): ${challenge.simulation.pValue.toFixed(4)}</li>
                        <li>Effect size: ${Math.abs(variantRate - baseRate).toFixed(2)}% difference</li>
                        <li>Consider both statistical significance AND practical significance</li>
                    </ul>
                </p>
            </div>
        `;
    }
}

// Initialize tooltips when the document is ready
document.addEventListener('DOMContentLoaded', initializeTooltips);
