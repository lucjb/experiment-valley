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
        followUpDecision: null,
        challenge: null,
        currentRound: 1,
        experimentsInCurrentRound: 0,
        correctInCurrentRound: 0,
        hasSubmitted: false
    },

    init() {
        this.initializeEventListeners();
        //this.initializeCheatSheet();
        this.initializeTabs();
    },

    debugMode() {
        return document.getElementById('debug-mode').checked;
    },

    initializeEventListeners() {
        // Start button
        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.startSession();
            });
        }

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
                if (!button.classList.contains('selected')) {
                    button.style.opacity = '1';
                }
            });

            button.addEventListener('mouseleave', () => {
                if (!button.classList.contains('selected')) {
                    button.style.opacity = '0.7';
                }
            });

            // Add touch event listeners alongside click events
            button.addEventListener('touchstart', () => {
                this.handleDecision(button.getAttribute('name'), button.getAttribute('value'));
            });
        });

        // Submit decision
        document.getElementById('submit-decision').addEventListener('click', () => {
            this.evaluateDecision();
        });

        // Next challenge
        document.getElementById('next-challenge-btn').addEventListener('click', () => this.handleNextChallenge());

        // Start new session
        document.getElementById('start-new-session').addEventListener('click', () => this.startNewSession());

        // Initialize cheat sheet
        //this.initializeCheatSheet();

        // Initialize feedback modal
        const feedbackModal = document.getElementById('feedback-modal');
        const closeFeedback = document.getElementById('close-feedback');
        const nextChallengeBtn = document.getElementById('next-challenge-btn');

        // Close feedback modal
        closeFeedback.addEventListener('click', () => {
            ModalManager.hide('feedback-modal');
            // Batch DOM operations
            const submitButton = document.getElementById('submit-decision');
            const decisionButtons = document.querySelectorAll('.decision-btn');

            // Update submit button
            submitButton.textContent = 'Show Feedback';
            submitButton.disabled = false;
            submitButton.classList.remove('opacity-50', 'cursor-not-allowed');

            // Update decision buttons in a single operation
            decisionButtons.forEach(button => {
                button.disabled = true;
                button.style.opacity = '0.5';
                button.style.cursor = 'not-allowed';
            });
        });

        // Close feedback when clicking outside
        feedbackModal.addEventListener('click', (e) => {
            if (e.target === feedbackModal) {
                ModalManager.hide('feedback-modal');
                // Batch DOM operations
                const submitButton = document.getElementById('submit-decision');
                const decisionButtons = document.querySelectorAll('.decision-btn');

                // Update submit button
                submitButton.textContent = 'Show Feedback';
                submitButton.disabled = false;
                submitButton.classList.remove('opacity-50', 'cursor-not-allowed');

                // Update decision buttons in a single operation
                decisionButtons.forEach(button => {
                    button.disabled = true;
                    button.style.opacity = '0.5';
                    button.style.cursor = 'not-allowed';
                });
            }
        });
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
            } else {
                content.classList.remove('hidden');
            }
        });

        // Set up click handlers and initial state
        document.querySelectorAll('.tab-button').forEach(button => {
            // Remove active class from all buttons
            button.classList.remove('active', 'border-blue-500', 'text-blue-600');
            button.classList.add('text-gray-500');
            
            // Add click handler
            button.addEventListener('click', () => {
                this.switchTab(button.getAttribute('data-tab'));
            });
        });

        // Set initial active state for metrics tab
        const metricsTab = document.querySelector('[data-tab="metrics"]');
        if (metricsTab) {
            metricsTab.classList.add('border-blue-500', 'text-blue-600');
            metricsTab.classList.remove('text-gray-500');
        }
    },

    switchTab(tabName) {
        // Remove active state from all tabs
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('border-blue-500', 'text-blue-600');
            btn.classList.add('text-gray-500');
        });

        // Add active state to clicked tab
        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeTab) {
            activeTab.classList.add('border-blue-500', 'text-blue-600');
            activeTab.classList.remove('text-gray-500');
        }

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
        const challengeContainer = document.getElementById('challenge-container');

        tutorialSection.classList.add('hidden');
        challengeContainer.classList.remove('hidden');

        // Show round splash for the first round
        this.showRoundSplash();

        // Only load the challenge if it hasn't been loaded yet
        if (!window.currentExperiment) {
            this.loadChallenge();
        }
    },

    async loadChallenge() {
        try {
            if (typeof generateABTestChallenge !== 'function') {
                throw new Error("generateABTestChallenge function is not defined");
            }

            // Define challenge sequence for each round
            const challengeSequences = {
                1: [winner().withBaseRateMismatch(), loser(), inconclusive()],
                2: [partialWinner(), partialLoser(), fastCompletion()],
                3: [slowCompletion(), fastCompletionWithPartialWeek(), inconclusive().withBaseRateMismatch()],
            };

            // Define round captions
            const roundCaptions = {
                1: "Warm Up!", // First round caption
                2: "Easy", // Second round caption
                // Add more round captions here as needed
            };

            // Generate a new challenge based on round and experiment number
            let challengeDesign;
            if (challengeSequences[this.state.currentRound]) {
                // Use predefined sequence for this round
                const sequence = challengeSequences[this.state.currentRound];
                const experimentIndex = this.state.experimentsInCurrentRound;

                if (experimentIndex < sequence.length) {
                    // Use the predefined challenge generator for this experiment
                    challengeDesign = sequence[experimentIndex];
                    console.log(`Round ${this.state.currentRound}, Experiment ${experimentIndex + 1}: Using ${sequence[experimentIndex].name} challenge generator`);
                } else {
                    // Fall back to random challenge if we somehow exceed the sequence length
                    challengeDesign = new ChallengeDesign();
                    console.log(`Round ${this.state.currentRound}, Experiment ${experimentIndex + 1}: Using random challenge generator (fallback)`);
                }
            } else {
                // For rounds without a predefined sequence, use random challenges
                challengeDesign = new ChallengeDesign();
                console.log(`Round ${this.state.currentRound}, Experiment ${this.state.experimentsInCurrentRound + 1}: Using random challenge generator`);
            }

            // Generate the challenge from the design
            window.currentExperiment = challengeDesign.generate();
            this.state.challenge = window.currentExperiment;

            // Analyze the experiment and store it globally
            window.currentAnalysis = analyzeExperiment(window.currentExperiment);

            // Log the analysis result
            console.log('=== EXPERIMENT ANALYSIS ===');
            console.log('Round:', this.state.currentRound);
            console.log('Experiment:', this.state.experimentsInCurrentRound + 1);
            console.log('Analysis:', window.currentAnalysis);

            // Update the UI with the new challenge
            this.updateExperimentDisplay();
            this.updateExecutionSection();
            this.updateMetricsTable();

            this.updateProgress();

            window.updateConfidenceIntervals(window.currentExperiment);

            // Initialize charts
            initializeCharts(window.currentExperiment);

            // Reset decisions
            this.resetDecisions();
            if (this.debugMode()) {
                this.addDebugAlerts();
            }
            return true;
        } catch (error) {
            console.error('Error loading challenge:', error);
            return false;
        }
    },

    // Helper function to create a warning icon with tooltip
    createWarningIcon(message) {
        const warningIcon = document.createElement('span');
        warningIcon.className = 'text-yellow-500 cursor-help tooltip-trigger';
        warningIcon.textContent = '⚠️';

        const tooltipContent = document.createElement('span');
        tooltipContent.className = 'tooltip-content';
        tooltipContent.innerHTML = message.replace(/\n/g, '<br>');
        warningIcon.appendChild(tooltipContent);

        // Add tooltip positioning
        warningIcon.addEventListener('mousemove', (e) => {
            const tooltip = warningIcon.querySelector('.tooltip-content');
            if (!tooltip) return;

            const rect = warningIcon.getBoundingClientRect();
            tooltip.style.left = (rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2)) + 'px';
            tooltip.style.top = (rect.top - tooltip.offsetHeight - 10) + 'px';
        });

        return warningIcon;
    },

    // Helper function to add warning to a cell
    addWarningToCell(cell, message) {
        const visitorsSpan = document.createElement('span');
        visitorsSpan.className = 'font-medium';
        visitorsSpan.textContent = cell.textContent;
        cell.textContent = '';
        cell.appendChild(visitorsSpan);

        const warningIcon = this.createWarningIcon(message);
        cell.appendChild(warningIcon);
    },

    addDebugAlerts() {
        this.addBaseConversionRateMissmatchAlert();
        this.addSampleSizeWarning();
    },

    addBaseConversionRateMissmatchAlert() {
        const analysis = window.currentAnalysis;
        if (!analysis.analysis.hasBaseRateMismatch) return;

        const baseRateCell = document.getElementById('base-rate');
        const { expected, actual, difference, pValue } = analysis.analysis.baseRate;
        
        const message = `Design Base Rate: ${formatPercent(expected)}\nActual Base Rate: ${formatPercent(actual)}\nDifference: ${formatPercent(difference)}\np-value: ${pValue.toFixed(4)}`;
        this.addWarningToCell(baseRateCell, message);
    },

    addSampleSizeWarning() {
        const analysis = window.currentAnalysis;
        const { sampleSize } = analysis.analysis;
        const { current, required } = analysis.analysis.runtime;
        
        if (current < required) return;

        // Check base variant
        if (sampleSize.actualBase < sampleSize.required) {
            const message = `Insufficient sample size (${sampleSize.actualBase.toLocaleString()} < ${sampleSize.required.toLocaleString()})`;
            this.addWarningToCell(document.getElementById('base-visitors'), message);
        }

        // Check variant
        if (sampleSize.actualVariant < sampleSize.required) {
            const message = `Insufficient sample size (${sampleSize.actualVariant.toLocaleString()} < ${sampleSize.required.toLocaleString()})`;
            this.addWarningToCell(document.getElementById('variant-visitors'), message);
        }

        // Check total sample size
        const totalVisitors = sampleSize.actualBase + sampleSize.actualVariant;
        const requiredTotal = sampleSize.required * 2;
        
        if (totalVisitors < requiredTotal) {
            const completeTextElement = document.getElementById('exp-complete-text');
            const message = `Runtime Complete but Insufficient sample size: ${totalVisitors.toLocaleString()} < ${requiredTotal.toLocaleString()}`;
            
            completeTextElement.textContent = '';
            completeTextElement.appendChild(this.createWarningIcon(message));
            completeTextElement.appendChild(document.createTextNode(` Complete | ${current}d | ${totalVisitors.toLocaleString()}v`));
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
        document.getElementById('exp-total-required-sample').textContent = (challenge.experiment.requiredSampleSizePerVariant * 2).toLocaleString();
        document.getElementById('exp-cycle-days').textContent = challenge.experiment.businessCycleDays === 1 ? '1 day' : '1 week';
        document.getElementById('exp-required-days').textContent = `${challenge.experiment.requiredRuntimeDays} days`;
    },

    // Helper function to measure text width
    measureTextWidth(text, referenceElement) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const style = window.getComputedStyle(referenceElement);
        context.font = `${style.fontSize} ${style.fontFamily}`;
        return context.measureText(text).width + 20; // Add padding
    },

    checkProgressBarSpace(progressPercent, totalVisitors, remainingVisitors, daysRemaining) {
        const progressBarContainer = document.getElementById('exp-progress-bar').parentElement;
        const containerWidth = progressBarContainer.offsetWidth;
        const progressBarWidth = (containerWidth * progressPercent) / 100;
        const remainingBarWidth = containerWidth - progressBarWidth;

        // Measure text widths once
        const visitorsText = `${totalVisitors.toLocaleString()}v`;
        const remainingText = `${remainingVisitors.toLocaleString()}v`;
        const daysText = `${daysRemaining}d`;

        const visitorsTextWidth = this.measureTextWidth(visitorsText, document.getElementById('exp-visitors-text'));
        const remainingTextWidth = this.measureTextWidth(remainingText, document.getElementById('exp-remaining-text'));
        const daysTextWidth = this.measureTextWidth(daysText, document.getElementById('exp-days-remaining-text'));

        // Check space availability with 5% buffer
        const SPACE_BUFFER = 1.05;
        return {
            hasEnoughSpaceForVisitors: progressBarWidth > (visitorsTextWidth * SPACE_BUFFER),
            hasEnoughSpaceForRemaining: remainingBarWidth > (remainingTextWidth * SPACE_BUFFER),
            hasEnoughSpaceForDays: remainingBarWidth > ((remainingTextWidth + daysTextWidth) * SPACE_BUFFER)
        };
    },

    addExecutionBarTooltip(progressBar, hasEnoughSampleSize, daysElapsed, totalDays) {
        // Always reset tooltip state first
        progressBar.classList.remove('tooltip-trigger');
        const existingTooltip = progressBar.querySelector('.tooltip-content');
        if (existingTooltip) {
            existingTooltip.remove();
        }
        progressBar.removeEventListener('mousemove', progressBar.mousemoveHandler);

        // Define tooltip scenarios
        const tooltipScenarios = [
            {
                condition: () => hasEnoughSampleSize && daysElapsed < totalDays && daysElapsed % 7 !== 0,
                message: 'Not Ready: Full Sample size has been reached but the last week is incomplete.'
            },
            {
                condition: () => hasEnoughSampleSize && daysElapsed >= totalDays && daysElapsed % 7 === 0,
                message: 'Ready: Full sample size has been reached at full weeks.'
            },
            {
                condition: () => !hasEnoughSampleSize && daysElapsed < totalDays,
                message: 'Not Ready: Not enough sample size.'
            },
            {
                condition: () => hasEnoughSampleSize && daysElapsed < totalDays && daysElapsed % 7 === 0,
                message: 'Ready: Full sample size has been reached at full weeks.'
            }

        ];

        // Check if any scenario matches
        const matchingScenario = tooltipScenarios.find(scenario => scenario.condition());

        // Handle tooltip
        if (matchingScenario) {
            // Add tooltip trigger class
            progressBar.classList.add('tooltip-trigger');

            // Create tooltip content
            const tooltipContent = document.createElement('span');
            tooltipContent.className = 'tooltip-content';
            tooltipContent.style.position = 'absolute';
            tooltipContent.style.zIndex = '1000';
            tooltipContent.style.backgroundColor = 'black';
            tooltipContent.style.color = 'white';
            tooltipContent.style.padding = '8px';
            tooltipContent.style.borderRadius = '4px';
            tooltipContent.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            tooltipContent.textContent = matchingScenario.message;
            
            // Add tooltip to the progress bar
            progressBar.appendChild(tooltipContent);

            // Add mousemove event listener for tooltip positioning
            const mousemoveHandler = function(e) {
                const tooltip = this.querySelector('.tooltip-content');
                if (!tooltip) return;

                // Get trigger position
                const rect = this.getBoundingClientRect();
                
                // Position tooltip above the trigger
                tooltip.style.left = (e.clientX - rect.left) + 'px';
                tooltip.style.top = (e.clientY - rect.top - tooltip.offsetHeight - 10) + 'px';
            };

            // Add new listener and store reference
            progressBar.addEventListener('mousemove', mousemoveHandler);
            progressBar.mousemoveHandler = mousemoveHandler;
        }
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
        progressStartDate.textContent = '';
        progressEndDate.textContent = '';

        // Calculate visitor counts
        const totalVisitors = challenge.simulation.actualVisitorsBase + challenge.simulation.actualVisitorsVariant;
        const requiredVisitors = challenge.experiment.requiredSampleSizePerVariant * 2;
        const remainingVisitors = Math.max(0, requiredVisitors - totalVisitors);

        // Update bar widths
        progressBar.style.width = `${Math.min(100, progressPercent)}%`;
        progressBarInvisible.style.width = `${Math.min(100, progressPercent)}%`;
        remainingBar.style.width = `${Math.max(0, 100 - progressPercent)}%`;
        remainingBarInvisible.style.width = `${Math.max(0, 100 - progressPercent)}%`;

        // Update progress bar classes based on completion state
        if (isComplete) {
            progressBar.classList.remove('rounded-l-full');
            progressBar.classList.add('rounded-full');
            remainingBar.classList.remove('rounded-r-full');
            remainingBar.classList.add('hidden');
        } else {
            progressBar.classList.remove('rounded-full');
            progressBar.classList.add('rounded-l-full');
            remainingBar.classList.remove('hidden');
            remainingBar.classList.add('rounded-r-full');
        }

        // Check if we have enough sample size and if elapsed days is a multiple of 7
        const hasEnoughSampleSize = totalVisitors >= (2 * challenge.experiment.requiredSampleSizePerVariant);
        const isFullWeek = daysElapsed % 7 === 0;

        // Set progress bar color based on conditions
        if (hasEnoughSampleSize && isFullWeek) {
            // Bright blue for complete weeks with enough sample size
            progressBar.style.backgroundColor = '#3b82f6'; // Tailwind blue-500
        } else {
            // Gray for incomplete weeks or insufficient sample size
            progressBar.style.backgroundColor = '#9ca3af'; // Tailwind gray-400
        }

        // Update text content
        if (isComplete) {
            completeText.classList.remove('hidden');
            completeText.textContent = `Complete | ${totalDays}d | ${totalVisitors}v`;
            progressStartDate.textContent = dateFormatter.format(startDate);
            visitorsText.textContent = dateFormatter.format(finishDate);
            progressEndDate.textContent = ''; // End date is not shown in complete state
        } else {
            // Always show dates
            progressStartDate.textContent = dateFormatter.format(startDate);
            progressEndDate.textContent = dateFormatter.format(finishDate);

            // Always show current visitors and elapsed days
            visitorsText.textContent = `${totalVisitors}v`;
            daysElapsedText.textContent = `${daysElapsed}d`;

            // Always show remaining information
            remainingText.textContent = `${remainingVisitors}v`;
            daysRemainingText.textContent = `${daysRemaining}d`;

            // Always show total information
            totalText.textContent = `${requiredVisitors}v`;
            totalDaysText.textContent = `${totalDays}d`;

            // Check space availability and adjust visibility if needed
            const spaceAvailability = this.checkProgressBarSpace(progressPercent, totalVisitors, remainingVisitors, daysRemaining);

            if (!spaceAvailability.hasEnoughSpaceForRemaining) {
                remainingText.textContent = '';
                daysRemainingText.textContent = '';
            }

            if (!spaceAvailability.hasEnoughSpaceForDays) {
                totalText.textContent = '';
                totalDaysText.textContent = '';
            }
        }

        // Add tooltip to progress bar
        this.addExecutionBarTooltip(progressBar, hasEnoughSampleSize, daysElapsed, totalDays);
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
        const progressPercent = (this.state.experimentsInCurrentRound / this.state.EXPERIMENTS_PER_SESSION) * 100;
        progressBar.style.width = `${progressPercent}%`;
        document.getElementById('current-experiment').textContent = this.state.experimentsInCurrentRound + 1;
    },

    handleDecision(decisionType, value) {
        if (decisionType === 'trust') {
            this.state.trustDecision = value;
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
            button.disabled = false; // Enable the buttons
            button.style.cursor = 'pointer'; // Reset cursor
        });

        // Reset state
        this.state.trustDecision = null;
        this.state.implementDecision = null;
        this.state.followUpDecision = null;
        this.state.hasSubmitted = false;

        // Reset submit button
        const submitButton = document.getElementById('submit-decision');
        submitButton.disabled = true;
        submitButton.classList.add('opacity-50', 'cursor-not-allowed');
        submitButton.textContent = 'Submit Decision';
    },

    async evaluateDecision() {
        if (!this.state.trustDecision || !this.state.implementDecision) {
            return;
        }

        try {
            // If this is a subsequent click, just show the feedback dialog
            if (this.state.hasSubmitted) {
                ModalManager.show('feedback-modal');
                return;
            }

            // Mark that we've submitted
            this.state.hasSubmitted = true;

            this.state.totalAttempts++;

            // Check if this is the last experiment of the round BEFORE incrementing
            const isLastExperiment = this.state.experimentsInCurrentRound === this.state.EXPERIMENTS_PER_SESSION - 1;

            this.state.experimentsInCurrentRound++;

            // Use the global analysis
            const analysis = window.currentAnalysis;

            // Compare user's choices with analysis result
            let correctChoices = 0;
            const totalChoices = 3;
            let feedbackMessage = '';

            // Check trustworthiness
            const userTrust = this.state.trustDecision; // true or false
            const analysisTrust = analysis.decision.trustworthy;

            if (userTrust === analysisTrust) {
                correctChoices++;
                feedbackMessage += '<p>Trustworthiness: <span class="text-green-500">Correct ✓</span></p>';
            } else {
                feedbackMessage += `<p>Trustworthiness: <span class="text-red-500">Incorrect ✗</span> (Should be: ${analysisTrust === 'TRUSTWORTHY' ? 'Yes' : 'No'})</p>`;
            }

            // Check decision
            const userDecision = this.state.implementDecision; // Full string value
            const analysisDecision = analysis.decision.decision;

            // Map the decision to a simpler format for display
            const displayDecision = analysisDecision === "KEEP_BASE" ? "Keep Base" :
                analysisDecision === "KEEP_VARIANT" ? "Keep Variant" :
                    analysisDecision === "KEEP_RUNNING" ? "Keep Running" :
                        analysisDecision;

            if (userDecision === analysisDecision) {
                correctChoices++;
                feedbackMessage += '<p>Decision: <span class="text-green-500">Correct ✓</span></p>';
            } else {
                feedbackMessage += `<p>Decision: <span class="text-red-500">Incorrect ✗</span> (Should be: ${displayDecision})</p>`;
            }

            // Check follow-up
            const userFollowUp = this.state.followUpDecision;
            const analysisFollowUp = analysis.decision.followUp || analysis.decision.follwUp; // Handle both spellings

            // Map the follow-up to a simpler format for display
            const displayFollowUp = analysisFollowUp === "CELEBRATE" ? "Celebrate" :
                analysisFollowUp === "ITERATE" ? "Iterate" :
                    analysisFollowUp === "VALIDATE" ? "Validate" :
                        analysisFollowUp === "RERUN" ? "Fix &Rerun" :
                            analysisFollowUp === "DO_NOTHING" ? "None" :
                                analysisFollowUp;

            if (userFollowUp === analysisFollowUp) {
                correctChoices++;
                feedbackMessage += '<p>Follow-up: <span class="text-green-500">Correct ✓</span></p>';
            } else {
                feedbackMessage += `<p>Follow-up: <span class="text-red-500">Incorrect ✗</span> (Should be: ${displayFollowUp})</p>`;
            }

            // Calculate score based on performance
            const isPerfect = (correctChoices === totalChoices);
            const isGood = (correctChoices >= 2);

            if (isPerfect) {
                this.state.score++;
                this.state.streak++;
                this.state.correctInCurrentRound++;
                feedbackMessage += `<p class="mt-4 text-lg font-semibold">Round ${this.state.currentRound} Progress: ${this.state.correctInCurrentRound}/${this.state.experimentsInCurrentRound} correct</p>`;
                ModalManager.showFeedback(true, `<p class="text-xl font-semibold mb-4">Perfect! All decisions were correct.</p>${feedbackMessage}`);
            } else if (isGood) {
                this.state.score += 0.5; // Half point for getting most right
                this.state.streak++;
                this.state.correctInCurrentRound++;
                feedbackMessage += `<p class="mt-4 text-lg font-semibold">Round ${this.state.currentRound} Progress: ${this.state.correctInCurrentRound}/${this.state.experimentsInCurrentRound} correct</p>`;
                ModalManager.showFeedback(true, `<p class="text-xl font-semibold mb-4">Good job! You got ${correctChoices}/${totalChoices} decisions correct.</p>${feedbackMessage}`);
            } else {
                this.state.streak = 0;
                feedbackMessage += `<p class="mt-4 text-lg font-semibold">Round ${this.state.currentRound} Progress: ${this.state.correctInCurrentRound}/${this.state.experimentsInCurrentRound} correct</p>`;
                ModalManager.showFeedback(false, `<p class="text-xl font-semibold mb-4">You got ${correctChoices}/${totalChoices} decisions correct.</p>${feedbackMessage}`);
            }

            const accuracy = Math.round((this.state.score / this.state.totalAttempts) * 100);
            this.updateScoreDisplay();
            this.updateStreakDisplay();
            this.updateAccuracyDisplay(accuracy);

            // Check if this was the last experiment in the current round
            if (this.state.experimentsInCurrentRound === this.state.EXPERIMENTS_PER_SESSION) {
                // Check if player got at least 2 experiments right
                if (this.state.correctInCurrentRound >= 2) {
                    // Do NOT increment the round number here - that happens in handleNextChallenge
                    // Only reset experiment counters
                    document.getElementById('next-challenge-btn').textContent = 'Next Round!';
                } else {
                    // End game
                    document.getElementById('next-challenge-btn').textContent = 'Done';
                }
            }

            // Disable all decision buttons after submission
            document.querySelectorAll('.decision-btn').forEach(button => {
                button.disabled = true;
                button.style.opacity = '0.5';
                button.style.cursor = 'not-allowed';
            });

        } catch (error) {
            console.error('Error evaluating decision:', error);
            ModalManager.showFeedback(false, 'Error evaluating decision. Please try again.');
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

    updateRoundDisplay() {
        document.getElementById('current-round').textContent = this.state.currentRound;
    },

    async handleNextChallenge() {
        const feedbackModal = document.getElementById('feedback-modal');
        const nextChallengeBtn = document.getElementById('next-challenge-btn');

        ModalManager.hide('feedback-modal');

        if (this.state.experimentsInCurrentRound === this.state.EXPERIMENTS_PER_SESSION) {
            // Always advance progress bar to 100% at the end of a round
            const progressBar = document.getElementById('progress-bar');
            progressBar.style.width = '100%';

            // Wait a moment to show the full progress bar
            await new Promise(resolve => setTimeout(resolve, 500));

            if (this.state.correctInCurrentRound >= 2) {
                // Start new round
                this.state.currentExperiment = 1; // Reset the experiment counter
                this.state.experimentsInCurrentRound = 0;
                this.state.correctInCurrentRound = 0;
                this.state.currentRound++; // Increment the round number
                this.updateRoundDisplay(); // Update the round display
                // Show round splash first
                this.showRoundSplash();
                // Wait for splash animation to complete before loading new challenge
                await new Promise(resolve => setTimeout(resolve, 2000));
                this.resetDecisions();
                this.loadChallenge();
                // Reset progress bar
                progressBar.style.width = '0%';
                document.getElementById('current-experiment').textContent = '1';
            } else {
                // End game
                this.showCompletionModal();
            }
        } else {
            this.resetDecisions();
            this.loadChallenge();
        }
    },

    showRoundSplash() {
        const splash = document.getElementById('round-splash');
        const overlay = document.getElementById('round-splash-overlay');
        if (!splash || !overlay) {
            return;
        }

        // Get the round caption if it exists
        const roundCaptions = {
            1: "Warm Up", // First round caption
            2: "Let's Begin!", // Second round caption
            // Add more round captions here as needed
        };

        const caption = roundCaptions[this.state.currentRound] || "";

        // Set the round text with caption - maintain original large font size and center the caption
        splash.innerHTML = `<div style="text-align: center;">
            <div style="font-size: 8rem; font-weight: bold;">Round ${this.state.currentRound}</div>
            ${caption ? `<div style="font-size: 2rem; margin-top: 1rem;">${caption}</div>` : ''}
        </div>`;

        // Show the overlay and blur effect
        overlay.classList.add('active');

        // Show the splash
        splash.style.display = 'block';
        splash.style.opacity = '0';
        splash.style.transform = 'translate(-50%, -50%) scale(0.5)';

        // Force reflow
        void splash.offsetWidth;

        // Start animation
        splash.style.opacity = '1';
        splash.style.transform = 'translate(-50%, -50%) scale(1)';

        // Hide the splash and overlay after animation completes
        setTimeout(() => {
            splash.style.opacity = '0';
            splash.style.transform = 'translate(-50%, -50%) scale(0.5)';

            setTimeout(() => {
                splash.style.display = 'none';
                overlay.classList.remove('active');
            }, 500);
        }, 1500);
    },

    showCompletionModal() {
        const experimentContainer = document.getElementById('challenge-container');
        const completionModal = document.getElementById('completion-modal');
        const feedbackModal = document.getElementById('feedback-modal');

        // Hide feedback modal first
        feedbackModal.classList.add('hidden');
        feedbackModal.classList.remove('fade-in');

        // Then hide experiment container
        experimentContainer.classList.add('fade-out');

        setTimeout(() => {
            document.getElementById('final-score').textContent = this.state.score;
            document.getElementById('final-accuracy').textContent = `${Math.round((this.state.score / this.state.totalAttempts) * 100)}%`;
            document.getElementById('final-round').textContent = this.state.currentRound;

            completionModal.classList.remove('hidden');
            setTimeout(() => {
                completionModal.classList.add('fade-in');
            }, 10);
        }, 500);
    },

    startNewSession() {
        const completionModal = document.getElementById('completion-modal');
        const experimentContainer = document.getElementById('challenge-container');
        const tutorialSection = document.getElementById('tutorial-section');

        // Hide modals and experiment container
        completionModal.classList.add('hidden');
        completionModal.classList.remove('fade-in');
        experimentContainer.classList.add('hidden');
        experimentContainer.classList.remove('fade-out');

        // Show tutorial section
        tutorialSection.classList.remove('hidden');

        // Reset state
        this.state.currentExperiment = 1;
        this.state.score = 0;
        this.state.streak = 0;
        this.state.totalAttempts = 0;
        this.state.currentRound = 1; // Reset round number for new session
        this.state.experimentsInCurrentRound = 0;
        this.state.correctInCurrentRound = 0;

        // Update displays
        this.updateScoreDisplay();
        this.updateStreakDisplay();
        this.updateAccuracyDisplay(0);
        this.updateRoundDisplay(); // Update the round display
        document.getElementById('current-experiment').textContent = this.state.currentExperiment;

        // Reset button text
        const nextButton = document.getElementById('next-challenge-btn');
        if (nextButton) {
            nextButton.textContent = 'Next!';
        }

        // Reset progress bar
        document.getElementById('progress-bar').style.width = '0%';

        // Clear any existing experiment data
        window.currentExperiment = null;
        window.currentAnalysis = null;
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
    document.addEventListener('DOMContentLoaded', function () {
        UIController.init();
    });
} else {
    UIController.init();
} 