// UI Controller
const UIController = {
    state: {
        score: 0,
        streak: 0,
        totalAttempts: 0,
        currentExperiment: 1,
        EXPERIMENTS_PER_SESSION: 3,
        trustDecision: null,
        implementDecision: null,
        challenge: null
    },

    init() {
        this.initializeEventListeners();
        this.initializeCheatSheet();
        this.initializeTabs();
    },

    initializeEventListeners() {
        // Start button
        document.getElementById('start-btn').addEventListener('click', (event) => {
            event.preventDefault();
            this.startSession();
        });

        // Decision buttons
        document.getElementById('trust-yes').addEventListener('click', () => this.handleDecision('trust', true));
        document.getElementById('trust-no').addEventListener('click', () => this.handleDecision('trust', false));
        document.getElementById('implement-yes').addEventListener('click', () => this.handleDecision('implement', true));
        document.getElementById('implement-no').addEventListener('click', () => this.handleDecision('implement', false));

        // Submit decision
        document.getElementById('submit-decision').addEventListener('click', () => {
            this.state.currentExperiment++;
            this.updateProgress();
            this.evaluateDecision(this.state.implementDecision);
        });

        // Next challenge
        document.getElementById('next-challenge-btn').addEventListener('click', () => this.handleNextChallenge());

        // Start new session
        document.getElementById('start-new-session').addEventListener('click', () => this.startNewSession());
    },

    initializeCheatSheet() {
        const cheatSheetBtn = document.getElementById('cheat-sheet-btn');
        const cheatSheetModal = document.getElementById('cheat-sheet-modal');
        const closeCheatSheet = document.getElementById('close-cheat-sheet');

        cheatSheetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            ModalManager.show('cheat-sheet-modal');
        });

        closeCheatSheet.addEventListener('click', () => {
            ModalManager.hide('cheat-sheet-modal');
        });

        cheatSheetModal.addEventListener('click', (e) => {
            if (e.target === cheatSheetModal) {
                ModalManager.hide('cheat-sheet-modal');
            }
        });
    },

    initializeTabs() {
        // Hide all tab content except metrics tab
        document.querySelectorAll('.tab-content').forEach(content => {
            if (content.id !== 'metrics-tab') {
                content.classList.add('hidden');
            }
        });

        // Set up click handlers
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', () => {
                this.switchTab(button.getAttribute('data-tab'));
            });
        });
    },

    switchTab(tabName) {
        // Remove active state from all tabs
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('border-blue-500', 'text-blue-600');
            btn.classList.add('text-gray-500');
        });

        // Add active state to clicked tab
        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        activeTab.classList.add('border-blue-500', 'text-blue-600');
        activeTab.classList.remove('text-gray-500');

        // Hide all tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });

        // Show selected tab content
        const selectedTab = document.getElementById(`${tabName}-tab`);
        if (selectedTab) {
            selectedTab.classList.remove('hidden');
        }
    },

    startSession() {
        const tutorialSection = document.getElementById('tutorial-section');
        tutorialSection.classList.add('fade-out');

        setTimeout(() => {
            tutorialSection.classList.add('hidden');
            document.getElementById('challenge-container').classList.remove('hidden');
            document.getElementById('challenge-container').classList.add('fade-in');
            this.loadChallenge();
        }, 500);
    },

    async loadChallenge() {
        console.log('Loading challenge for experiment:', this.state.currentExperiment, 'of', this.state.EXPERIMENTS_PER_SESSION);
        
        if (this.state.currentExperiment > this.state.EXPERIMENTS_PER_SESSION) {
            console.log('All experiments completed, showing modal');
            this.showCompletionModal();
            return;
        }

        const experimentContainer = document.getElementById('challenge-container');
        experimentContainer.classList.add('fade-out');

        await new Promise(resolve => setTimeout(resolve, 500));

        ModalManager.show('loading-overlay');
        this.resetDecisions();
        this.updateProgress();

        try {
            if (typeof generateABTestChallenge !== 'function') {
                throw new Error("Challenge generator not found");
            }

            this.state.challenge = generateABTestChallenge();
            this.updateExperimentDisplay();
            this.updateExecutionSection();
            this.updateMetricsTable();

            ModalManager.show('chart-loading');

            setTimeout(() => {
                ModalManager.hide('chart-loading');
                initializeCharts(this.state.challenge);
                experimentContainer.classList.remove('fade-out');
                experimentContainer.classList.add('fade-in');
            }, 500);

        } catch (error) {
            console.error('Error loading challenge:', error);
            alert('Error loading challenge');
        } finally {
            ModalManager.hide('loading-overlay');
        }
    },

    updateExperimentDisplay() {
        const challenge = this.state.challenge;
        const formatPercentage = (value) => {
            const percentage = value * 100;
            return Number.isInteger(percentage) ? `${percentage}%` : `${percentage.toFixed(1)}%`;
        };

        // Update experiment parameters
        document.getElementById('exp-alpha').textContent = formatPercentage(challenge.experiment.alpha);
        document.getElementById('exp-beta').textContent = formatPercentage(1 - challenge.experiment.beta);
        document.getElementById('exp-base-rate').textContent = `${(challenge.experiment.baseConversionRate * 100).toFixed(2)}%`;
        document.getElementById('exp-min-effect').textContent = `${(challenge.experiment.minimumRelevantEffect * 100).toFixed(2)}%`;
        document.getElementById('exp-visitors').textContent = challenge.experiment.visitorsPerDay.toLocaleString();
        document.getElementById('exp-required-sample').textContent = challenge.experiment.requiredSampleSizePerVariant.toLocaleString();
        document.getElementById('exp-cycle-days').textContent = challenge.experiment.businessCycleDays === 1 ? '1 day' : '1 week';
        document.getElementById('exp-required-days').textContent = `${challenge.experiment.requiredRuntimeDays} days`;
    },

    updateExecutionSection() {
        const challenge = this.state.challenge;
        const currentDate = new Date();
        const daysElapsed = challenge.simulation.timeline.currentRuntimeDays;
        const totalDays = challenge.experiment.requiredRuntimeDays;
        const daysRemaining = totalDays - daysElapsed;
        const isComplete = daysElapsed >= totalDays;

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

        // Update progress bar and annotations
        const progressPercent = Math.round((daysElapsed / totalDays) * 100);
        const progressBar = document.getElementById('exp-progress-bar');
        const daysElapsedText = document.getElementById('exp-days-elapsed-text');
        const daysRemainingText = document.getElementById('exp-days-remaining-text');
        const completeText = document.getElementById('exp-complete-text');
        const progressStartDate = document.getElementById('progress-start-date');
        const progressEndDate = document.getElementById('progress-end-date');

        progressBar.style.width = `${Math.min(100, progressPercent)}%`;

        if (isComplete) {
            daysElapsedText.classList.add('hidden');
            daysRemainingText.classList.add('hidden');
            completeText.classList.remove('hidden');
            completeText.textContent = `Experiment Complete (${totalDays} days)`;
        } else {
            daysElapsedText.classList.remove('hidden');
            daysRemainingText.classList.remove('hidden');
            completeText.classList.add('hidden');
            daysElapsedText.textContent = `${daysElapsed} days elapsed`;
            daysRemainingText.textContent = `${daysRemaining} days remaining`;
        }

        progressStartDate.textContent = dateFormatter.format(startDate);
        progressEndDate.textContent = dateFormatter.format(finishDate);
    },

    updateMetricsTable() {
        const challenge = this.state.challenge;
        const formatDelta = (value, isPercentage = false) => {
            const sign = value > 0 ? '+' : '';
            return isPercentage ?
                `${sign}${(value * 100).toFixed(2)}%` :
                `${sign}${value}`;
        };

        const formatUplift = (value) => {
            const sign = value > 0 ? '+' : '';
            return `${sign}${(value * 100).toFixed(2)}%`;
        };

        // Update base metrics
        document.getElementById('base-visitors').textContent = challenge.simulation.actualVisitorsBase;
        document.getElementById('base-conversions').textContent = challenge.simulation.actualConversionsBase;
        document.getElementById('base-rate').textContent = `${(challenge.simulation.actualBaseConversionRate * 100).toFixed(2)}%`;

        // Update variant metrics
        document.getElementById('variant-visitors').textContent = challenge.simulation.actualVisitorsVariant;
        document.getElementById('variant-conversions').textContent = challenge.simulation.actualConversionsVariant;
        document.getElementById('variant-rate').textContent = `${(challenge.simulation.variantConversionRate * 100).toFixed(2)}%`;

        // Update delta metrics
        document.getElementById('delta-visitors').textContent = formatDelta(challenge.simulation.actualVisitorsVariant - challenge.simulation.actualVisitorsBase);
        document.getElementById('delta-conversions').textContent = formatDelta(challenge.simulation.actualConversionsVariant - challenge.simulation.actualConversionsBase);
        document.getElementById('delta-rate').textContent = formatDelta(challenge.simulation.variantConversionRate - challenge.simulation.actualBaseConversionRate, true);

        // Update uplift metrics
        document.getElementById('visitor-uplift').textContent = formatUplift(challenge.simulation.visitorUplift);
        document.getElementById('conversion-uplift').textContent = formatUplift(challenge.simulation.conversionUplift);
        document.getElementById('uplift-value').textContent = formatUplift(challenge.simulation.uplift);
    },

    updateProgress() {
        const progressBar = document.getElementById('progress-bar');
        const progressPercent = ((this.state.currentExperiment - 1) / this.state.EXPERIMENTS_PER_SESSION) * 100;
        progressBar.style.width = `${progressPercent}%`;
        if (this.state.currentExperiment <= this.state.EXPERIMENTS_PER_SESSION) {
            document.getElementById('current-experiment').textContent = this.state.currentExperiment;
        }
    },

    handleDecision(decisionType, value) {
        const trustButtons = [document.getElementById('trust-yes'), document.getElementById('trust-no')];
        const implementButtons = [document.getElementById('implement-yes'), document.getElementById('implement-no')];

        if (decisionType === 'trust') {
            this.state.trustDecision = value;
            trustButtons.forEach(btn => {
                btn.classList.remove('bg-green-700', 'bg-red-700');
                btn.disabled = false;
            });
            if (value) {
                document.getElementById('trust-yes').classList.add('bg-green-700');
            } else {
                document.getElementById('trust-no').classList.add('bg-red-700');
            }
        } else if (decisionType === 'implement') {
            this.state.implementDecision = value;
            implementButtons.forEach(btn => {
                btn.classList.remove('bg-green-700', 'bg-red-700');
                btn.disabled = false;
            });
            if (value) {
                document.getElementById('implement-yes').classList.add('bg-green-700');
            } else {
                document.getElementById('implement-no').classList.add('bg-red-700');
            }
        }

        this.checkDecisions();
    },

    checkDecisions() {
        const submitBtn = document.getElementById('submit-decision');
        if (this.state.trustDecision !== null && this.state.implementDecision !== null) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            submitBtn.disabled = true;
            submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    },

    resetDecisions() {
        console.log('Resetting decisions');
        this.state.trustDecision = null;
        this.state.implementDecision = null;
        const buttons = ['trust-yes', 'trust-no', 'implement-yes', 'implement-no'];
        buttons.forEach(id => {
            const btn = document.getElementById(id);
            btn.classList.remove('bg-green-700', 'bg-red-700');
            btn.disabled = false;
        });
        this.checkDecisions();
    },

    async evaluateDecision(userChoice) {
        console.log('Evaluating decision for experiment:', this.state.currentExperiment);
        if (!this.state.challenge) {
            console.error("No challenge loaded");
            alert("No challenge available. Try reloading.");
            return;
        }

        ModalManager.show('loading-overlay');

        try {
            this.state.totalAttempts++;
            const correctDecision = this.state.challenge.simulation.variantConversionRate > this.state.challenge.simulation.actualBaseConversionRate;

            if (userChoice === correctDecision) {
                this.state.score++;
                this.state.streak++;
                ModalManager.showFeedback(true, 'Correct!');
            } else {
                this.state.streak = 0;
                ModalManager.showFeedback(false, 'Incorrect');
            }

            const accuracy = Math.round((this.state.score / this.state.totalAttempts) * 100);
            this.updateScoreDisplay();
            this.updateStreakDisplay();
            this.updateAccuracyDisplay(accuracy);

            // Check if this was the last experiment
            if (this.state.currentExperiment - 1 === this.state.EXPERIMENTS_PER_SESSION) {
                document.getElementById('next-challenge-btn').textContent = 'Done!';
            }

        } finally {
            ModalManager.hide('loading-overlay');
        }
    },

    updateScoreDisplay() {
        document.getElementById('score').textContent = this.state.score;
        document.getElementById('modal-score').textContent = this.state.score;
    },

    updateStreakDisplay() {
        document.getElementById('streak').textContent = this.state.streak;
        document.getElementById('modal-streak').textContent = this.state.streak;
    },

    updateAccuracyDisplay(accuracy) {
        document.getElementById('accuracy').textContent = `${accuracy}%`;
        document.getElementById('modal-accuracy').textContent = `${accuracy}%`;
    },

    async handleNextChallenge() {
        const feedbackModal = document.getElementById('feedback-modal');
        feedbackModal.classList.add('fade-out');

        await new Promise(resolve => setTimeout(resolve, 500));
        feedbackModal.classList.add('hidden');
        feedbackModal.classList.remove('fade-out');

        if (this.state.currentExperiment > this.state.EXPERIMENTS_PER_SESSION) {
            this.showCompletionModal();
        } else {
            this.resetDecisions();
            this.loadChallenge();
        }
    },

    showCompletionModal() {
        console.log('Showing completion modal');
        const experimentContainer = document.getElementById('challenge-container');
        const completionModal = document.getElementById('completion-modal');

        experimentContainer.classList.add('fade-out');

        setTimeout(() => {
            document.getElementById('final-score').textContent = this.state.score;
            document.getElementById('final-accuracy').textContent = `${Math.round((this.state.score / this.state.totalAttempts) * 100)}%`;

            completionModal.classList.remove('hidden');
            setTimeout(() => {
                completionModal.classList.add('fade-in');
            }, 10);
        }, 500);
    },

    startNewSession() {
        console.log('Starting new session');
        const completionModal = document.getElementById('completion-modal');
        const experimentContainer = document.getElementById('challenge-container');

        completionModal.classList.add('hidden');
        experimentContainer.classList.remove('hidden');

        // Reset state
        this.state.currentExperiment = 1;
        this.state.score = 0;
        this.state.streak = 0;
        this.state.totalAttempts = 0;

        // Update displays
        this.updateScoreDisplay();
        this.updateStreakDisplay();
        this.updateAccuracyDisplay(0);
        document.getElementById('current-experiment').textContent = this.state.currentExperiment;

        // Reset button text
        const nextButton = document.getElementById('next-challenge-btn');
        if (nextButton) {
            nextButton.textContent = 'Next!';
        }

        // Start new challenge
        this.loadChallenge();
    },

    shareOnTwitter() {
        const text = `I just completed the A/B Testing Gym challenge with a score of ${this.state.score} and ${Math.round((this.state.score / this.state.totalAttempts) * 100)}% accuracy! Try it yourself!`;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`);
    },

    shareOnLinkedIn() {
        const text = `I just completed the A/B Testing Gym challenge with a score of ${this.state.score} and ${Math.round((this.state.score / this.state.totalAttempts) * 100)}% accuracy! Try it yourself!`;
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}&summary=${encodeURIComponent(text)}`);
    }
};

// Initialize UI Controller when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => UIController.init());
} else {
    UIController.init();
} 