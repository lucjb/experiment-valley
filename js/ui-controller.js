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
        document.querySelectorAll('.decision-btn').forEach(button => {
            button.addEventListener('click', () => {
                // Remove active state from all buttons in the same group
                const name = button.getAttribute('name');
                document.querySelectorAll(`.decision-btn[name="${name}"]`).forEach(btn => {
                    btn.style.opacity = '0.7';
                    btn.style.transform = 'scale(1)';
                    btn.classList.remove('selected');
                });
                
                // Add active state to clicked button
                button.style.opacity = '1';
                button.style.transform = 'scale(1.05)';
                button.classList.add('selected');
                
                this.handleDecision(name, button.getAttribute('value'));
            });

            // Add hover effects
            button.addEventListener('mouseenter', () => {
                // Only change opacity if button is not selected
                if (!button.classList.contains('selected')) {
                    button.style.opacity = '1';
                }
            });

            button.addEventListener('mouseleave', () => {
                // Only reset opacity if button is not selected
                if (!button.classList.contains('selected')) {
                    button.style.opacity = '0.7';
                }
            });
        });

        // Submit decision
        document.getElementById('submit-decision').addEventListener('click', () => {
            if (this.state.implementDecision === 'keep_variant') {
                this.state.currentExperiment++;
                this.updateProgress();
                this.evaluateDecision(true);
            } else if (this.state.implementDecision === 'keep_base') {
                this.state.currentExperiment++;
                this.updateProgress();
                this.evaluateDecision(false);
            } else if (this.state.implementDecision === 'keep_running') {
                this.state.currentExperiment++;
                this.updateProgress();
                this.evaluateDecision(null);
            }
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
            month: 'short',
            day: 'numeric'
        });

        // Update progress bar and annotations
        const progressPercent = Math.round((daysElapsed / totalDays) * 100);
        const progressBar = document.getElementById('exp-progress-bar');
        const progressBarInvisible = document.getElementById('exp-progress-bar-invisible');
        const remainingBar = document.getElementById('exp-remaining-bar');
        const remainingBarInvisible = document.getElementById('exp-remaining-bar-invisible');
        const visitorsText = document.getElementById('exp-visitors-text');
        const remainingText = document.getElementById('exp-remaining-text');
        const totalText = document.getElementById('exp-total-text');
        const completeText = document.getElementById('exp-complete-text');
        const progressStartDate = document.getElementById('progress-start-date');
        const progressEndDate = document.getElementById('progress-end-date');
        const daysElapsedText = document.getElementById('exp-days-elapsed-text');
        const daysRemainingText = document.getElementById('exp-days-remaining-text');
        const totalDaysText = document.getElementById('exp-total-days-text');

        // Reset all text content first
        visitorsText.textContent = '';
        remainingText.textContent = '';
        totalText.textContent = '';
        completeText.textContent = '';
        daysElapsedText.textContent = '';
        daysRemainingText.textContent = '';
        totalDaysText.textContent = '';

        // Update bar widths
        progressBar.style.width = `${Math.min(100, progressPercent)}%`;
        progressBarInvisible.style.width = `${Math.min(100, progressPercent)}%`;
        remainingBar.style.width = `${Math.max(0, 100 - progressPercent)}%`;
        remainingBarInvisible.style.width = `${Math.max(0, 100 - progressPercent)}%`;

        // Calculate visitor counts
        const totalVisitors = challenge.simulation.actualVisitorsBase + challenge.simulation.actualVisitorsVariant;
        const requiredVisitors = challenge.experiment.requiredSampleSizePerVariant * 2;
        const remainingVisitors = requiredVisitors - totalVisitors;

        // Update text content
        if (isComplete) {
            document.getElementById('exp-complete-text').classList.remove('hidden');
            document.getElementById('exp-complete-text').textContent = `Complete | ${totalDays} days | ${totalVisitors.toLocaleString()} visitors`;
            document.getElementById('progress-start-date').textContent = dateFormatter.format(startDate);
            document.getElementById('exp-visitors-text').textContent = dateFormatter.format(finishDate);
            document.getElementById('progress-end-date').textContent = '';
        } else {
            document.getElementById('progress-start-date').textContent = dateFormatter.format(startDate);
            document.getElementById('exp-visitors-text').textContent = `${totalVisitors.toLocaleString()} visitors`;
            document.getElementById('exp-remaining-text').textContent = `${remainingVisitors.toLocaleString()} remaining`;
            document.getElementById('exp-total-text').textContent = `${requiredVisitors.toLocaleString()} total`;
            document.getElementById('exp-days-elapsed-text').textContent = `${daysElapsed} days`;
            document.getElementById('exp-days-remaining-text').textContent = `${daysRemaining} remaining`;
            document.getElementById('exp-total-days-text').textContent = `${totalDays} total`;
            document.getElementById('progress-end-date').textContent = dateFormatter.format(finishDate);
        }
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
        if (decisionType === 'trust') {
            this.state.trustDecision = value === 'yes';
        } else if (decisionType === 'decision') {
            this.state.implementDecision = value;
        } else if (decisionType === 'follow_up') {
            this.state.followUpDecision = value;
        }

        this.checkDecisions();
    },

    checkDecisions() {
        const submitButton = document.getElementById('submit-decision');
        
        // Check if any button in each group is selected
        const trustSelected = Array.from(document.querySelectorAll('.decision-btn[name="trust"]')).some(btn => btn.classList.contains('selected'));
        const decisionSelected = Array.from(document.querySelectorAll('.decision-btn[name="decision"]')).some(btn => btn.classList.contains('selected'));
        const followUpSelected = Array.from(document.querySelectorAll('.decision-btn[name="follow_up"]')).some(btn => btn.classList.contains('selected'));

        console.log('Trust selected:', trustSelected);
        console.log('Decision selected:', decisionSelected);
        console.log('Follow up selected:', followUpSelected);

        if (trustSelected && decisionSelected && followUpSelected) {
            submitButton.disabled = false;
            submitButton.classList.remove('opacity-50', 'cursor-not-allowed');
        } else {
            submitButton.disabled = true;
            submitButton.classList.add('opacity-50', 'cursor-not-allowed');
        }
    },

    resetDecisions() {
        // Reset all decision buttons
        document.querySelectorAll('.decision-btn').forEach(button => {
            button.style.opacity = '0.7';
            button.style.transform = 'scale(1)';
            button.classList.remove('selected');
        });

        // Reset state
        this.state.trustDecision = null;
        this.state.implementDecision = null;
        this.state.followUpDecision = null;

        // Reset submit button
        const submitButton = document.getElementById('submit-decision');
        submitButton.disabled = true;
        submitButton.classList.add('opacity-50', 'cursor-not-allowed');
    },

    async evaluateDecision(userChoice) {
        console.log('Evaluating decision for experiment:', this.state.currentExperiment);
        if (!this.state.challenge) {
            console.error("No challenge loaded");
            alert("No challenge available. Try reloading.");
            return;
        }

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
        } catch (error) {
            console.error('Error evaluating decision:', error);
            alert('Error evaluating decision');
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