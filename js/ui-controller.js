// UI Controller for AB Testing Gym
function updateExecutionSection(experimentData) {
    const currentDate = new Date();
    const daysElapsed = experimentData.simulation.timeline.currentRuntimeDays;
    const totalDays = experimentData.experiment.requiredRuntimeDays;
    const daysRemaining = totalDays - daysElapsed;

    // Calculate dates
    const startDate = new Date(currentDate);
    startDate.setDate(startDate.getDate() - daysElapsed);

    const finishDate = new Date(currentDate);
    finishDate.setDate(finishDate.getDate() + daysRemaining);

    // Format dates
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });

    // Update DOM elements
    document.getElementById('exp-start-date').textContent = dateFormatter.format(startDate);
    document.getElementById('exp-current-date').textContent = dateFormatter.format(currentDate);
    document.getElementById('exp-days-elapsed').textContent = daysElapsed;
    document.getElementById('exp-days-remaining').textContent = daysRemaining;
    document.getElementById('exp-finish-date').textContent = dateFormatter.format(finishDate);

    // Update progress bar
    const progressPercent = Math.round((daysElapsed / totalDays) * 100);
    const progressBar = document.getElementById('exp-progress-bar');
    const progressText = document.getElementById('exp-progress-text');

    progressBar.style.width = `${progressPercent}%`;
    progressText.textContent = `${progressPercent}%`;
}

// Export functions for global use
window.updateExecutionSection = updateExecutionSection;
