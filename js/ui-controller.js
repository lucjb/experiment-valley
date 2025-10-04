// UI Controller
const UIController = {
    state: {
        totalAttempts: 0,
        totalDecisions: 0,
        correctDecisions: 0,
        currentExperiment: 1,
        EXPERIMENTS_PER_SESSION: 3,
        trustDecision: null,
        implementDecision: null,
        followUpDecision: null,
        challenge: null,
        currentRound: 1,
        experimentsInCurrentRound: 0,
        correctInCurrentRound: 0,
        hasSubmitted: false,
        impact: 0,
        userCumulativeEffect: 0,
        competitorCumulativeEffect: 0,
        currentCompetitor: null,
        selectedCompetitor: null,
        roundResults: [] // Store results for each experiment in the current round
    },

    init() {
        this.initializeEventListeners();
        //this.initializeCheatSheet();
        this.initializeTabs();
        // Leaderboard moved to separate page; no refresh here
    },

    debugMode() {
        return document.getElementById('debug-mode').checked;
    },

    initializeEventListeners() {
        // Competitor selection
        document.querySelectorAll('.competitor-card').forEach(card => {
            card.addEventListener('click', () => {
                // Remove selected state from all cards
                document.querySelectorAll('.competitor-card').forEach(c => {
                    c.style.opacity = '0.7';
                    c.style.transform = 'scale(1)';
                });
                
                // Add selected state to clicked card
                card.style.opacity = '1';
                card.style.transform = 'scale(1.05)';
                
                // Enable start button
                const startBtn = document.getElementById('start-btn');
                startBtn.disabled = false;
                
                // Store selected competitor
                this.state.selectedCompetitor = card.getAttribute('data-competitor');
            });

            // Add hover effects
            card.addEventListener('mouseenter', () => {
                if (card.style.opacity !== '1') {
                    card.style.opacity = '0.9';
                }
            });

            card.addEventListener('mouseleave', () => {
                if (card.style.opacity !== '1') {
                    card.style.opacity = '0.7';
                }
            });
        });

        // Start button
        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (this.state.selectedCompetitor) {
                    // Use the name from the modal if available, otherwise use cached name or prompt
                    const key = 'abgym_display_name';
                    let name = window.playerName || localStorage.getItem(key);
                    if (!name) {
                        name = prompt('Enter your display name for the leaderboard:') || 'Player';
                        localStorage.setItem(key, name);
                    }
                    // Start backend session and log event
                    try {
                        if (typeof Backend !== 'undefined') {
                            await Backend.startSession({
                                displayName: name,
                                meta: { ts: Date.now(), competitor: this.state.selectedCompetitor }
                            });
                            await Backend.logEvent({
                                eventType: 'session_start',
                                roundNumber: this.state.currentRound,
                                payload: { competitor: this.state.selectedCompetitor }
                            });
                        }
                    } catch (err) {
                        console.error('Failed to start backend session', err);
                    }
                    this.startSession();
                }
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

        // Use event delegation for elements that might not exist initially
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'submit-decision') {
                this.evaluateDecision();
            } else if (e.target && e.target.id === 'next-challenge-btn') {
                this.handleNextChallenge();
            } else if (e.target && e.target.id === 'start-new-session') {
                this.startNewSession();
            } else if (e.target && e.target.id === 'exit-game-btn') {
                this.showExitConfirmation();
            } else if (e.target && e.target.id === 'exit-confirm-btn') {
                this.exitGame();
            } else if (e.target && e.target.id === 'exit-cancel-btn') {
                const exitModal = document.getElementById('exit-confirmation-modal');
                if (exitModal) {
                    exitModal.classList.add('hidden');
                }
            }
        });

        // Initialize exit confirmation modal
        const exitModal = document.getElementById('exit-confirmation-modal');
        if (exitModal) {
            exitModal.addEventListener('click', (e) => {
                if (e.target === exitModal) {
                    exitModal.classList.add('hidden');
                }
            });
        }

        // Initialize cheat sheet
        //this.initializeCheatSheet();

        // Initialize feedback modal
        const feedbackModal = document.getElementById('feedback-modal');
        const closeFeedback = document.getElementById('close-feedback');

        // Close feedback modal
        if (closeFeedback) {
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
        }

        // Close feedback when clicking outside
        if (feedbackModal) {
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
        }
    },

    // refreshLeaderboard removed

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

        // Exit game button - use event delegation since the button is in a hidden container initially
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'exit-game-btn') {
                this.exitGame();
            }
        });
    },

    showExitConfirmation() {
        const exitModal = document.getElementById('exit-confirmation-modal');
        if (exitModal) {
            exitModal.classList.remove('hidden');
        }
    },

    async exitGame() {
        try {
            // End the backend session
            if (typeof Backend !== 'undefined' && Backend.isInitialized()) {
                await Backend.endSession();
            }
        } catch (error) {
            console.error('Error ending session:', error);
        }

        // Hide the exit confirmation modal
        const exitModal = document.getElementById('exit-confirmation-modal');
        if (exitModal) {
            exitModal.classList.add('hidden');
        }

        // Show the completion modal (game over)
        await this.showCompletionModal();
    },

    resetGameState() {
        // Reset all state variables
        this.state.totalAttempts = 0;
        this.state.totalDecisions = 0;
        this.state.correctDecisions = 0;
        this.state.currentExperiment = 1;
        this.state.trustDecision = null;
        this.state.implementDecision = null;
        this.state.followUpDecision = null;
        this.state.challenge = null;
        this.state.currentRound = 1;
        this.state.experimentsInCurrentRound = 0;
        this.state.correctInCurrentRound = 0;
        this.state.hasSubmitted = false;
        this.state.impact = 0;
        this.state.userCumulativeEffect = 0;
        this.state.competitorCumulativeEffect = 0;
        this.state.currentCompetitor = null;
        this.state.selectedCompetitor = null;
        this.state.roundResults = [];

        // Reset UI elements
        this.updateRoundDisplay();
        this.updateAccuracyDisplay();
        this.updateImpactDisplay();
        this.resetDecisions();
        this.updateExperimentDots();
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
        const gameMenu = document.getElementById('game-menu');
        const tutorialSection = document.getElementById('tutorial-section');
        const experimentContainer = document.getElementById('challenge-container');

        // Hide game menu and tutorial section
        if (gameMenu) {
            gameMenu.classList.add('hidden');
        }
        if (tutorialSection) {
            tutorialSection.classList.add('hidden');
        }

        // Show experiment container with loading state
        experimentContainer.classList.remove('hidden');
        experimentContainer.classList.add('fade-in');
        experimentContainer.classList.add('compact');
        
        // Show loading state
        this.showLoadingState();

        // Reset scroll to top when entering the first challenge
        try {
            window.scrollTo({ top: 0, behavior: 'auto' });
        } catch (_) {
            window.scrollTo(0, 0);
        }

        // Set the selected competitor for the entire session
        this.state.currentCompetitor = VirtualCompetitors[this.state.selectedCompetitor];
        
        // Update competitor name in UI
        this.updateCompetitorName();

        // Load the first challenge
        this.loadChallenge();
    },

    showLoadingState() {
        const experimentContainer = document.getElementById('challenge-container');
        const loadingHTML = `
            <div id="loading-overlay" class="loading-overlay">
                <div class="text-center">
                    <div class="loading-spinner mx-auto mb-4"></div>
                    <p class="text-white text-lg font-medium">Loading experiment...</p>
                </div>
            </div>
        `;
        experimentContainer.insertAdjacentHTML('beforeend', loadingHTML);
    },

    hideLoadingState() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.remove();
        }
    },

    async loadChallenge() {
        try {
            // Ensure viewport starts at top for each challenge
            try {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } catch (_) {
                window.scrollTo(0, 0);
            }
            
            if (typeof generateABTestChallenge !== 'function') {
                throw new Error("generateABTestChallenge function is not defined");
            }

            // Clean up warning emoji from conversion rates tab header
            const conversionTab = document.querySelector('[data-tab="conversion"]');
            if (conversionTab) {
                conversionTab.textContent = 'Conversion Rate';
            }

            // Define challenge sequence for each round
            const challengeSequences = {
                1: [winner(), inconclusive(), partialLoser()],
                2: [partialLoser().withBaseRateMismatch(), partialLoser().withVisitorsLoss(), partialLoser().withSampleRatioMismatch()],
                3: [slowCompletion(), fastWinner(), fastLoserWithPartialWeek()],
                4: [slowCompletion().withBaseRateMismatch(), fastLoserWithPartialWeek().withVisitorsLoss(), loser()],
                5: [partialWinner(), partialLoser(), inconclusive()],
                6: [winner().withLowerIsBetter(), inconclusive(), loser().withLowerIsBetter()],
                7: [partialWinner().withLowerIsBetter(), bigLoser().withLowerIsBetter(), loser().withLowerIsBetter()]
            };

            // Define round captions
            const roundCaptions = {
                1: "Warm Up!", // First round caption
                2: "Let's Begin!", // Second round caption
                // Add more round captions here as needed
            };

            const caption = roundCaptions[this.state.currentRound] || "";

            // Reset visitors header
            const visitorsHeader = document.querySelector('.metrics-table th:nth-child(2)');
            if (visitorsHeader) {
                visitorsHeader.textContent = 'Visitors';
            }

            // Generate a new challenge based on round and experiment number
            let challengeDesign;
            const sequence = challengeSequences[this.state.currentRound];
            const experimentIndex = this.state.experimentsInCurrentRound;

            if (sequence && experimentIndex < sequence.length) {
                // Use the predefined challenge generator for this experiment
                challengeDesign = sequence[experimentIndex];
            } else {
                // After predefined sequences or for rounds without a sequence, randomly sample from all scenarios
                const allScenarios = Object.values(challengeSequences).flat();
                challengeDesign = allScenarios[Math.floor(Math.random() * allScenarios.length)];
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
            
            // Hide loading state
            this.hideLoadingState();
            
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
        this.addSampleRatioMismatchAlert();
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

    addSampleRatioMismatchAlert() {
        if (!this.debugMode()) return;

        const analysis = window.currentAnalysis;
        if (!analysis || !analysis.analysis.hasSignificantRatioMismatch) return;

        const visitorsHeader = document.querySelector('.metrics-table th:nth-child(2)');
        if (!visitorsHeader) return;

        const message = `Sample Ratio Mismatch detected (p-value<0.0001)`;
        
        visitorsHeader.textContent = '';
        visitorsHeader.appendChild(document.createTextNode('Visitors'));
        visitorsHeader.appendChild(this.createWarningIcon(message));
    },

    // Attach tooltip behaviour to dynamically added elements
    initializeTooltipTriggers(parent) {
        if (!parent) return;
        const triggers = parent.querySelectorAll('.tooltip-trigger');
        triggers.forEach(trigger => {
            trigger.addEventListener('mousemove', function (e) {
                const tooltip = this.querySelector('.tooltip-content');
                if (!tooltip) return;

                const rect = this.getBoundingClientRect();
                const tooltipHeight = tooltip.offsetHeight;
                const tooltipWidth = tooltip.offsetWidth;
                const spaceAbove = rect.top;
                const spaceBelow = window.innerHeight - rect.bottom;

                let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);
                if (left < 10) left = 10;
                if (left + tooltipWidth > window.innerWidth - 10) {
                    left = window.innerWidth - tooltipWidth - 10;
                }

                let top;
                if (spaceAbove >= tooltipHeight + 10) {
                    top = rect.top - tooltipHeight - 10;
                } else if (spaceBelow >= tooltipHeight + 10) {
                    top = rect.bottom + 10;
                } else {
                    top = spaceAbove > spaceBelow ?
                        rect.top - tooltipHeight - 10 :
                        rect.bottom + 10;
                }

                tooltip.style.left = left + 'px';
                tooltip.style.top = top + 'px';
            });
        });
    },

    // Explanations for each decision are provided in the analysis object
    getTrustExplanation(analysis) {
        return analysis.decision.trustworthyReason || '';
    },

    getDecisionExplanation(analysis) {
        return analysis.decision.decisionReason || '';
    },

    getFollowUpExplanation(analysis) {
        return analysis.decision.followUpReason || '';
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
        document.getElementById('exp-required-days').textContent = `${challenge.experiment.requiredRuntimeDays} days`;
        const direction = challenge.experiment.improvementDirection === window.IMPROVEMENT_DIRECTION.LOWER ? 'Lower is Better' : 'Higher is Better';
        document.getElementById('exp-improvement-direction').textContent = direction;

        // Update conversion rates tab header if there's data loss
        if (this.debugMode() && window.currentAnalysis?.analysis?.hasDataLoss) {
            const conversionTab = document.querySelector('[data-tab="conversion"]');
            if (conversionTab) {
                conversionTab.textContent = 'Conversion Rate ⚠️';
            }
        }
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
        document.getElementById('base-rate').textContent = `${(challenge.simulation.baseConversionRate * 100).toFixed(2)}%`;


        // Update variant metrics
        document.getElementById('variant-visitors').textContent = challenge.simulation.actualVisitorsVariant;
        document.getElementById('variant-conversions').textContent = challenge.simulation.actualConversionsVariant;
        document.getElementById('variant-rate').textContent = `${(challenge.simulation.variantConversionRate * 100).toFixed(2)}%`;

        // Update delta metrics
        document.getElementById('delta-visitors').textContent = formatDelta(challenge.simulation.actualVisitorsVariant - challenge.simulation.actualVisitorsBase);
        document.getElementById('delta-conversions').textContent = formatDelta(challenge.simulation.actualConversionsVariant - challenge.simulation.actualConversionsBase);
        document.getElementById('delta-rate').textContent = formatDelta(challenge.simulation.variantConversionRate - challenge.simulation.baseConversionRate, true);

        // Update uplift metrics
        document.getElementById('visitor-uplift').textContent = formatUplift(challenge.simulation.visitorUplift);
        document.getElementById('conversion-uplift').textContent = formatUplift(challenge.simulation.conversionUplift);
        document.getElementById('uplift-value').textContent = formatUplift(challenge.simulation.uplift);
    },

    updateProgress() {
        // Update experiment dots
        this.updateExperimentDots();
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
            const experiment = window.currentExperiment;
            

            // Calculate decision comparison once for all uses
            const totalChoices = 3;
            const correctChoices = (analysis.decision?.trustworthy === this.state.trustDecision ? 1 : 0)
                + (analysis.decision?.decision === this.state.implementDecision ? 1 : 0)
                + (analysis.decision?.followUp === this.state.followUpDecision ? 1 : 0);
            
            // Store for use in feedback modal and backend logging
            this.state.currentExperimentCorrectChoices = correctChoices;
            this.state.currentExperimentTotalChoices = totalChoices;
            
            // Update accuracy tracking
            this.state.totalDecisions += totalChoices;
            this.state.correctDecisions += correctChoices;
            
            // Update accuracy display immediately
            const accuracy = this.state.totalDecisions > 0 ? 
                Math.round((this.state.correctDecisions / this.state.totalDecisions) * 100) : 0;
            this.updateAccuracyDisplay(accuracy);
            

            // Calculate impact
            const actualEffect = experiment.simulation.actualEffectSize;
            const expectedDailyVisitors = experiment.experiment.visitorsPerDay;

            // Calculate impact in terms of conversions per day
            const calculateConversionImpact = (effectSize) => {
                return Math.round(effectSize * expectedDailyVisitors);
            };

            // Record user's chosen option
            let userImpact = 0;
            let userChoice = "None";
            if (this.state.implementDecision === "KEEP_VARIANT") {
                userChoice = "Variant";
            } else if (this.state.implementDecision === "KEEP_BASE") {
                userChoice = "Base";
            } else if (this.state.implementDecision === "KEEP_RUNNING") {
                userChoice = "Keep Running";
            }

            // Get competitor's decision
            const competitorDecision = this.state.currentCompetitor.makeDecision(experiment);
            let competitorImpact = 0;
            let competitorChoice = "None";

            if (competitorDecision.decision === "KEEP_VARIANT") {
                competitorChoice = "Variant";
            } else if (competitorDecision.decision === "KEEP_BASE") {
                competitorChoice = "Base";
            } else if (competitorDecision.decision === "KEEP_RUNNING") {
                competitorChoice = "Keep Running";
            }

            // Determine which variant is better based on improvement direction
            const actualEffectCpd = calculateConversionImpact(actualEffect);
            const directionFactor = experiment.experiment.improvementDirection === window.IMPROVEMENT_DIRECTION.LOWER ? -1 : 1;
            const adjustedEffect = actualEffectCpd * directionFactor;
            const variantBetter = adjustedEffect > 0;
            const effectMagnitude = Math.abs(actualEffectCpd);

            // Calculate the actual impact based on improvement direction
            // For LOWER_IS_BETTER: positive impact when variant is lower (negative effect)
            // For HIGHER_IS_BETTER: positive impact when variant is higher (positive effect)
            const actualImpactCpd = actualEffectCpd * directionFactor;

            // Impacts shown in the table should reflect the signed true effect
            let userImpactDisplay = 0;
            if (this.state.implementDecision === "KEEP_VARIANT") {
                userImpactDisplay = actualImpactCpd;
            }

            let competitorImpactDisplay = 0;
            if (competitorDecision.decision === "KEEP_VARIANT") {
                competitorImpactDisplay = actualImpactCpd;
            }

            // Calculate impact for user
            if (this.state.implementDecision === "KEEP_VARIANT") {
                // User chose variant: impact depends on whether variant is better
                if (variantBetter) {
                    userImpact = effectMagnitude; // Positive impact for good variant
                } else {
                    userImpact = -effectMagnitude; // Negative impact for bad variant
                }
            } else {
                // User chose base or keep running: always 0 impact (no change from baseline)
                userImpact = 0;
            }

            // Calculate impact for competitor
            if (competitorDecision.decision === "KEEP_VARIANT") {
                // Competitor chose variant: impact depends on whether variant is better
                if (variantBetter) {
                    competitorImpact = effectMagnitude; // Positive impact for good variant
                } else {
                    competitorImpact = -effectMagnitude; // Negative impact for bad variant
                }
            } else {
                // Competitor chose base or keep running: always 0 impact (no change from baseline)
                competitorImpact = 0;
            }

            // Update cumulative effects
            this.state.userCumulativeEffect += userImpact;
            this.state.competitorCumulativeEffect += competitorImpact;

            // Decision tracking is now done immediately after submission

            // Emit a single experiment event per experiment
            try {
                if (typeof Backend !== 'undefined') {
                    // Use the values calculated once above
                    const correctChoices = this.state.currentExperimentCorrectChoices;
                    const totalChoices = this.state.currentExperimentTotalChoices;
                    const isPerfect = (correctChoices === totalChoices);
                    const isGood = (correctChoices === totalChoices - 1);
                    await Backend.logEvent({
                        eventType: 'experiment',
                        roundNumber: this.state.currentRound,
                        experimentNumber: this.state.experimentsInCurrentRound,
                        payload: {
                            correctChoices,
                            totalChoices,
                            userChoice: {
                                trust: this.state.trustDecision,
                                implement: this.state.implementDecision,
                                follow_up: this.state.followUpDecision
                            },
                            analysisSummary: {
                                trustworthy: analysis.trustworthy,
                                bestDecision: analysis.bestDecision,
                                followUp: analysis.followUp
                            },
                            impacts: {
                                userImpact,
                                competitorImpact,
                                actualEffectCpd: Math.round(experiment.simulation.actualEffectSize * experiment.experiment.visitorsPerDay)
                            }
                        }
                    });
                }
            } catch (e) { console.error(e); }

            // Update impact displays
            this.updateImpactDisplay();

            // Update modal displays
            const bestVariant = variantBetter ? "Variant" : "Base";
            
            // Determine if user made the correct decision
            const userImplementDecision = this.state.implementDecision;
            const correctDecision = analysis.decision.decision;
            const userMadeCorrectDecision = (userImplementDecision === correctDecision);
            
            // Create the impact message based on relative impact compared to opponent
            let impactMessage;
            let impactDisplayClass;
            let impactTextClass;
            
            // Calculate relative impact (user impact - opponent impact)
            const userImpactValue = userImpact;
            const opponentImpactValue = competitorImpact;
            const relativeImpact = userImpactValue - opponentImpactValue;
            
            // Determine if user made the optimal choice (chose the better variant)
            const userChoseBest = (variantBetter && userImplementDecision === "KEEP_VARIANT") ||
                                 (!variantBetter && userImplementDecision === "KEEP_BASE");
            
            // Color coding based on relative impact
            if (relativeImpact > 0) {
                // User scores positive relative impact
                impactDisplayClass = 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-2 mt-2';
                impactTextClass = 'text-green-700 font-semibold';
            } else if (relativeImpact < 0) {
                // User scores negative relative impact
                impactDisplayClass = 'bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-lg p-2 mt-2';
                impactTextClass = 'text-red-700 font-semibold';
            } else {
                // User scores zero relative impact
                impactDisplayClass = 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-2 mt-2';
                impactTextClass = 'text-blue-700 font-semibold';
            }
            
            // Construct message based on true effect and choices
            if (actualEffectCpd === 0) {
                // Line 1: Prefix and true effect
                impactMessage = `No difference between base and variant.`;
                
                // Line 2: Opponent choice (empty for no effect case)
                const opponentChoiceElement = document.getElementById('modal-opponent-choice');
                if (opponentChoiceElement) {
                    opponentChoiceElement.textContent = '';
                }
                
                // Line 3: Impact with badge
                const impactLineElement = document.getElementById('modal-impact-line');
                if (impactLineElement) {
                    impactLineElement.innerHTML = `your relative impact is <span class="inline-flex items-center justify-center px-2 py-1 text-xs font-bold text-white bg-blue-500 rounded-full shadow-sm">0 cpd</span>`;
                }
            } else {
                const isCorrect = userChoseBest || actualEffectCpd === 0;
                var prefix = isCorrect ? "Correct!" : "Oops!";
                if (userImplementDecision === "KEEP_RUNNING") {
                    prefix = "";
                }
                
                let opponentChoiceText;
                if (competitorDecision.decision === "KEEP_VARIANT") {
                    opponentChoiceText = "variant";
                } else if (competitorDecision.decision === "KEEP_BASE") {
                    opponentChoiceText = "base";
                } else {
                    opponentChoiceText = "keep running";
                }
                
                // Line 1: Prefix and true effect
                const isLowerBetter = experiment.experiment.improvementDirection === window.IMPROVEMENT_DIRECTION.LOWER;
                const lowerBetterClarification = isLowerBetter ? ' (but lower is better)' : '';
                impactMessage = `${prefix} The true effect is ${actualEffectCpd} cpd${lowerBetterClarification}.`;
                
                // Line 2: Opponent choice
                const opponentChoiceElement = document.getElementById('modal-opponent-choice');
                if (opponentChoiceElement) {
                    const opponentName = this.state.currentCompetitor ? this.state.currentCompetitor.name : 'Opponent';
                    opponentChoiceElement.textContent = `Since ${opponentName} chose ${opponentChoiceText},`;
                }
                
                // Line 3: Impact with badge
                const badgeColor = relativeImpact > 0 ? 'bg-green-500' : relativeImpact < 0 ? 'bg-red-500' : 'bg-blue-500';
                const impactLineElement = document.getElementById('modal-impact-line');
                const plus = relativeImpact >= 0 ? '+' : '';
                if (impactLineElement) {
                    impactLineElement.innerHTML = `your relative impact is <span class="inline-flex items-center justify-center px-2 py-1 text-xs font-bold text-white ${badgeColor} rounded-full shadow-sm">${plus}${relativeImpact} cpd</span>`;
                }
            }
            
            // Apply consistent styling to all text elements based on the color scheme
            const textColorClass = relativeImpact > 0 ? 'text-green-700 font-semibold' : relativeImpact < 0 ? 'text-red-700 font-semibold' : 'text-blue-700 font-semibold';
            
            const bestVariantElement = document.getElementById('modal-best-variant');
            const opponentChoiceElement = document.getElementById('modal-opponent-choice');
            const impactLineElement = document.getElementById('modal-impact-line');
            
            if (bestVariantElement) bestVariantElement.className = textColorClass;
            if (opponentChoiceElement) opponentChoiceElement.className = textColorClass;
            if (impactLineElement) {
                // Keep the existing content but update the text color
                const currentContent = impactLineElement.innerHTML;
                impactLineElement.className = textColorClass;
                impactLineElement.innerHTML = currentContent;
            }
            
            // Determine if user and competitor made correct choices
            const userMadeCorrectChoice = (userChoice === bestVariant);
            const competitorMadeCorrectChoice = (competitorChoice === bestVariant);
            
            // Create icons for impact table
            const userIcon = userMadeCorrectChoice ? 
                '<svg class="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' :
                '<svg class="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
            
            const competitorIcon = competitorMadeCorrectChoice ? 
                '<svg class="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' :
                '<svg class="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
            

            const modalElements = {
                'modal-best-variant': impactMessage,
                'modal-user-choice': userChoice,
                'modal-user-impact': userImpactDisplay,
                'modal-competitor-choice': competitorChoice,
                'modal-competitor-impact': competitorImpactDisplay,
                'modal-user-icon': userIcon,
                'modal-competitor-icon': competitorIcon
            };

            // Safely update modal elements
            Object.entries(modalElements).forEach(([id, value]) => {
                const element = document.getElementById(id);
                if (element) {
                    if (id.includes('icon')) {
                        element.innerHTML = value;
                    } else {
                        element.textContent = value;
                    }
                }
            });

            // Set impact table content cell colors to match their icons
            const userChoiceElement = document.getElementById('modal-user-choice');
            const userImpactElement = document.getElementById('modal-user-impact');
            const competitorChoiceElement = document.getElementById('modal-competitor-choice');
            const competitorImpactElement = document.getElementById('modal-competitor-impact');
            
            // Determine colors based on impact values
            let userColor, competitorColor;
            if (userImpact === competitorImpact) {
                // Same impact - both blue
                userColor = 'text-blue-600';
                competitorColor = 'text-blue-600';
            } else if (userImpact > competitorImpact) {
                // User has higher impact - user green, competitor red
                userColor = 'text-green-600';
                competitorColor = 'text-red-600';
            } else {
                // Competitor has higher impact - competitor green, user red
                userColor = 'text-red-600';
                competitorColor = 'text-green-600';
            }
            
            if (userChoiceElement) userChoiceElement.className = `py-1 px-2 ${userColor} whitespace-nowrap`;
            if (userImpactElement) userImpactElement.className = `py-1 px-2 ${userColor} font-semibold whitespace-nowrap`;
            if (competitorChoiceElement) competitorChoiceElement.className = `py-1 px-2 ${competitorColor} whitespace-nowrap`;
            if (competitorImpactElement) competitorImpactElement.className = `py-1 px-2 ${competitorColor} font-semibold whitespace-nowrap`;

            // Update impact display styling
            const impactDisplay = document.getElementById('impact-display');
            const impactText = document.getElementById('modal-best-variant');
            if (impactDisplay && impactText) {
                impactDisplay.className = impactDisplayClass;
                impactText.className = impactTextClass;
            }

            // Update competitor name in the modal
            this.updateCompetitorName();

            // Compare user's choices with analysis result
            let feedbackMessage = '';

            // Check trustworthiness
            const userTrust = this.state.trustDecision === "TRUSTWORTHY";
            const analysisTrust = analysis.decision.trustworthy === "TRUSTWORTHY";
            const displayTrust = analysisTrust ? "Yes" : "No";
            const userTrustDisplay = userTrust ? "Yes" : "No";

            // Check decision
            const userDecision = this.state.implementDecision;
            const analysisDecision = analysis.decision.decision;
            const displayDecision = analysisDecision === "KEEP_VARIANT" ? "Keep Variant" :
                                  analysisDecision === "KEEP_BASE" ? "Keep Base" : "Keep Running";
            const userDecisionDisplay = userDecision === "KEEP_VARIANT" ? "Keep Variant" :
                                      userDecision === "KEEP_BASE" ? "Keep Base" : "Keep Running";

            // Check follow-up
            const userFollowUp = this.state.followUpDecision;
            const analysisFollowUp = analysis.decision.followUp;
            const displayFollowUp = analysisFollowUp === "CELEBRATE" ? "Celebrate" :
                                  analysisFollowUp === "ITERATE" ? "Iterate" :
                                  analysisFollowUp === "VALIDATE" ? "Validate" :
                                  analysisFollowUp === "RERUN" ? "Fix & Rerun" : "None";
            const userFollowUpDisplay = userFollowUp === "CELEBRATE" ? "Celebrate" :
                                      userFollowUp === "ITERATE" ? "Iterate" :
                                      userFollowUp === "VALIDATE" ? "Validate" :
                                      userFollowUp === "RERUN" ? "Fix & Rerun" : "None";

            // Build table rows with optional tooltips
            const trustExplanation = userTrust === analysisTrust ? '' : this.getTrustExplanation(analysis);
            const decisionExplanation = userDecision === analysisDecision ? '' : this.getDecisionExplanation(analysis);
            const followUpExplanation = userFollowUp === analysisFollowUp ? '' : this.getFollowUpExplanation(analysis);

            const trustIcon = userTrust === analysisTrust ?
                '<svg class="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' :
                `<span class="tooltip-trigger"><svg class="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg><span class="tooltip-content">${trustExplanation}</span></span>`;

            const decisionIcon = userDecision === analysisDecision ?
                '<svg class="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' :
                `<span class="tooltip-trigger"><svg class="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg><span class="tooltip-content">${decisionExplanation}</span></span>`;

            const followUpIcon = userFollowUp === analysisFollowUp ?
                '<svg class="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' :
                `<span class="tooltip-trigger"><svg class="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg><span class="tooltip-content">${followUpExplanation}</span></span>`;

            // Use the values calculated once above
            const feedbackCorrectChoices = this.state.currentExperimentCorrectChoices;
            const feedbackTotalChoices = this.state.currentExperimentTotalChoices;

            // Create table format
            feedbackMessage = `
                <div class="overflow-x-auto">
                    <table class="w-full text-sm border-collapse">
                        <thead>
                            <tr class="bg-gray-50">
                                <th class="text-left py-1 px-2 font-medium text-gray-700 whitespace-nowrap"></th>
                                <th class="text-left py-1 px-2 font-medium text-gray-700 whitespace-nowrap">Your Choice</th>
                                <th class="text-left py-1 px-2 font-medium text-gray-700 whitespace-nowrap">Correct Choice</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="border-b border-gray-100">
                                <td class="py-1 px-2 flex items-center space-x-2 whitespace-nowrap">
                                    ${trustIcon}
                                    <span class="font-medium text-gray-700">Trustworthy?</span>
                                </td>
                                <td class="py-1 px-2 ${userTrust === analysisTrust ? 'text-green-600' : 'text-red-600'} whitespace-nowrap">${userTrustDisplay}</td>
                                <td class="py-1 px-2 text-gray-600 whitespace-nowrap">${displayTrust}</td>
                            </tr>
                            <tr class="border-b border-gray-100">
                                <td class="py-1 px-2 flex items-center space-x-2 whitespace-nowrap">
                                    ${decisionIcon}
                                    <span class="font-medium text-gray-700">Decision</span>
                                </td>
                                <td class="py-1 px-2 ${userDecision === analysisDecision ? 'text-green-600' : 'text-red-600'} whitespace-nowrap">${userDecisionDisplay}</td>
                                <td class="py-1 px-2 text-gray-600 whitespace-nowrap">${displayDecision}</td>
                            </tr>
                            <tr>
                                <td class="py-1 px-2 flex items-center space-x-2 whitespace-nowrap">
                                    ${followUpIcon}
                                    <span class="font-medium text-gray-700">Follow-up</span>
                                </td>
                                <td class="py-1 px-2 ${userFollowUp === analysisFollowUp ? 'text-green-600' : 'text-red-600'} whitespace-nowrap">${userFollowUpDisplay}</td>
                                <td class="py-1 px-2 text-gray-600 whitespace-nowrap">${displayFollowUp}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;

            // Calculate performance
            const isPerfect = (feedbackCorrectChoices === feedbackTotalChoices);
            const isGood = (feedbackCorrectChoices >= 2);

            // Store the result for this experiment in the round
            const experimentResult = {
                experiment: this.state.experimentsInCurrentRound,
                isPerfect: isPerfect,
                isGood: isGood,
                correctChoices: feedbackCorrectChoices
            };
            this.state.roundResults[this.state.experimentsInCurrentRound - 1] = experimentResult;

            // Update experiment dots
            this.updateExperimentDots();

            // Update feedback icon and title based on performance
            const feedbackIcon1 = document.getElementById('feedback-icon-1');
            const feedbackIcon2 = document.getElementById('feedback-icon-2');
            const feedbackIcon3 = document.getElementById('feedback-icon-3');
            const feedbackTitle = document.getElementById('feedback-title');
            const resultsCardTitle = document.getElementById('results-card-title');
            const resultsDisplay = document.getElementById('results-display');
            
            // Create the results card title with round and experiment info
            const resultsCardTitleText = `Round ${this.state.currentRound}, Experiment ${this.state.experimentsInCurrentRound}`;
            
            // Update tick marks based on round progress
            this.updateRoundTickMarks();
            
            if (isPerfect) {
                this.state.correctInCurrentRound++;
                
                feedbackTitle.textContent = 'Score Card';
                resultsCardTitle.textContent = resultsCardTitleText;
                
                // Update results display for perfect performance
                resultsDisplay.className = 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-2 mt-2';
                resultsDisplay.innerHTML = `
                    <p class="text-xs text-gray-600 leading-tight text-center">
                        <span class="text-green-700 font-semibold">Perfect! All 3 decisions correct!</span>
                    </p>
                `;
                
                ModalManager.showFeedback(true, feedbackMessage);
            } else if (isGood) {
                this.state.correctInCurrentRound++;
                
                feedbackTitle.textContent = 'Score Card';
                resultsCardTitle.textContent = resultsCardTitleText;
                
                // Update results display for good performance
                resultsDisplay.className = 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-2 mt-2';
                resultsDisplay.innerHTML = `
                    <p class="text-xs text-gray-600 leading-tight text-center">
                        <span class="text-blue-700 font-semibold">Good Job! You got ${feedbackCorrectChoices} out of 3 right!</span>
                    </p>
                `;
                
                ModalManager.showFeedback(true, feedbackMessage);
            } else {
                feedbackTitle.textContent = 'Score Card';
                resultsCardTitle.textContent = resultsCardTitleText;
                
                // Update results display for poor performance
                resultsDisplay.className = 'bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-lg p-2 mt-2';
                if (feedbackCorrectChoices === 0) {
                    resultsDisplay.innerHTML = `
                        <p class="text-xs text-gray-600 leading-tight text-center">
                            <span class="text-red-700 font-semibold">Oops! No correct decisions!</span>
                        </p>
                    `;
                } else {
                    resultsDisplay.innerHTML = `
                        <p class="text-xs text-gray-600 leading-tight text-center">
                            <span class="text-red-700 font-semibold">Oops! Just ${feedbackCorrectChoices} correct, not enough!</span>
                        </p>
                    `;
                }
                
                if (feedbackCorrectChoices === 0) {
                    ModalManager.showFeedback(false, feedbackMessage);
                } else {
                    ModalManager.showFeedback(false, feedbackMessage);
                }
            }

            // Initialize tooltips for any mistake explanations
            this.initializeTooltipTriggers(document.getElementById('feedback-message'));

            // Accuracy is now updated immediately after each decision submission

            // Set button text based on experiment number
            const nextButton = document.getElementById('next-challenge-btn');
            if (this.state.experimentsInCurrentRound === this.state.EXPERIMENTS_PER_SESSION) {
                // Experiment 3 - check if player got at least 2 experiments right
                if (this.state.correctInCurrentRound >= 2) {
                    nextButton.textContent = 'Next Round!';
                } else {
                    nextButton.textContent = 'Done';
                }
            } else {
                // Experiments 1 and 2 - just "Next"
                nextButton.textContent = 'Next';
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


    updateAccuracyDisplay(accuracy) {
        const accuracyElement = document.getElementById('accuracy');
        const modalAccuracyElement = document.getElementById('modal-accuracy');
        
        console.log(`Updating accuracy display to: ${accuracy}%`);
        console.log(`Accuracy element found:`, !!accuracyElement);
        console.log(`Modal accuracy element found:`, !!modalAccuracyElement);
        
        if (accuracyElement) {
            accuracyElement.textContent = `${accuracy}%`;
            console.log(`Updated accuracy element to: ${accuracy}%`);
            console.log(`Element content after update:`, accuracyElement.textContent);
        } else {
            console.error('Accuracy element not found!');
        }
        if (modalAccuracyElement) {
            modalAccuracyElement.textContent = `${accuracy}%`;
            console.log(`Updated modal accuracy element to: ${accuracy}%`);
        }
    },

    updateRoundDisplay() {
        document.getElementById('current-round').textContent = this.state.currentRound;
    },

    async handleNextChallenge() {
        console.log('handleNextChallenge called');
        console.log('Current state:', {
            experimentsInCurrentRound: this.state.experimentsInCurrentRound,
            EXPERIMENTS_PER_SESSION: this.state.EXPERIMENTS_PER_SESSION,
            correctInCurrentRound: this.state.correctInCurrentRound,
            currentRound: this.state.currentRound
        });
        
        const feedbackModal = document.getElementById('feedback-modal');
        const nextChallengeBtn = document.getElementById('next-challenge-btn');

        ModalManager.hide('feedback-modal');

        if (this.state.experimentsInCurrentRound === this.state.EXPERIMENTS_PER_SESSION) {

            console.log('Round completed. Correct answers:', this.state.correctInCurrentRound, 'Required: 2');
            if (this.state.correctInCurrentRound >= 2) {
                console.log('Advancing to next round. Current round:', this.state.currentRound);
                // Log round_end and update session summary
                (async () => {
                    try {
                        if (typeof Backend !== 'undefined') {
                            await Backend.logEvent({
                                eventType: 'round_end',
                                roundNumber: this.state.currentRound,
                                payload: {
                                    correct_in_round: this.state.correctInCurrentRound,
                                    experiments_in_round: this.state.EXPERIMENTS_PER_SESSION
                                }
                            });
                            // Update session summary with current metrics
                            const accuracy = this.state.totalDecisions > 0 ? 
                                Math.round((this.state.correctDecisions / this.state.totalDecisions) * 100) : 0;
                            await Backend.upsertSessionSummary({
                                maxRound: this.state.currentRound,
                                impactCpd: this.state.userCumulativeEffect,
                                accuracyPct: accuracy
                            });
                        }
                    } catch (e) { console.error('Failed to update session summary after round', e); }
                })();
                // Start new round
                this.state.currentExperiment = 1; // Reset the experiment counter
                this.state.experimentsInCurrentRound = 0;
                this.state.correctInCurrentRound = 0;
                this.state.currentRound++; // Increment the round number
                this.state.roundResults = []; // Reset round results for new round
                this.updateExperimentDots(); // Update experiment dots for new round
                this.updateRoundDisplay(); // Update the round display
                // Show round splash first
                console.log('About to show splash for round:', this.state.currentRound);
                this.showRoundSplash();
                // Wait for splash animation to complete before loading new challenge
                await new Promise(resolve => setTimeout(resolve, 2000));
                this.resetDecisions();
                this.loadChallenge();
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
        console.log('showRoundSplash called for round:', this.state.currentRound);
        const splash = document.getElementById('round-splash');
        const overlay = document.getElementById('round-splash-overlay');
        console.log('Splash element found:', !!splash);
        console.log('Overlay element found:', !!overlay);
        if (!splash || !overlay) {
            console.log('Missing splash elements!');
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

        // Reset splash state first
        splash.classList.remove('show');
        splash.style.display = 'block';
        
        // Force reflow
        void splash.offsetWidth;

        // Show the overlay and blur effect
        overlay.classList.add('active');

        // Show the splash
        splash.classList.add('show');

        // Hide the splash and overlay after animation completes
        setTimeout(() => {
            splash.classList.remove('show');

            setTimeout(() => {
                overlay.classList.remove('active');
                // If this is Round 1, we need to ensure the challenge is properly loaded
                if (this.state.currentRound === 1) {
                    // The challenge should already be loaded but blurred, now it will be unblurred
                }
            }, 500);
        }, 1500);
    },

    async getUserRanks() {
        try {
            if (typeof Backend === 'undefined' || !Backend.isInitialized()) {
                return { roundsRank: null, impactRank: null };
            }
            
            const client = Backend.getClient();
            const [profiles, summaries] = await Promise.all([
                client.from('profiles').select('id, display_name'),
                client.from('session_summaries').select('profile_id, max_round_reached, total_impact_cpd, accuracy_pct, opponent_name, opponent_impact_cpd')
            ]);

            if (profiles.error || summaries.error) {
                console.error('Failed to fetch leaderboard data:', profiles.error || summaries.error);
                return { roundsRank: null, impactRank: null };
            }

            // Aggregate leaderboard data (same logic as leaderboard.js)
            const byProfile = new Map();
            const nameCounts = new Map();
            
            // Count occurrences of each display name to handle collisions
            profiles.data.forEach(p => {
                const count = nameCounts.get(p.display_name) || 0;
                nameCounts.set(p.display_name, count + 1);
            });
            
            profiles.data.forEach(p => {
                const count = nameCounts.get(p.display_name);
                const displayName = count > 1 ? `${p.display_name} #${p.id.slice(-4)}` : p.display_name;
                
                byProfile.set(p.id, {
                    displayName: displayName,
                    originalName: p.display_name,
                    profileId: p.id,
                    bestAccuracy: 0,
                    maxRound: 0,
                    maxImpact: 0,
                    maxRoundSession: null,
                    opponentName: null,
                    opponentImpact: 0
                });
            });

            summaries.data.forEach(s => {
                const agg = byProfile.get(s.profile_id);
                if (!agg) return;
                
                const round = Number(s.max_round_reached) || 0;
                const accuracy = Number(s.accuracy_pct) || 0;
                const impact = Number(s.total_impact_cpd) || 0;
                const opponentImpact = Number(s.opponent_impact_cpd) || 0;
                
                // Best accuracy across all sessions
                agg.bestAccuracy = Math.max(agg.bestAccuracy, accuracy);
                
                // Max round reached across all sessions
                if (round > agg.maxRound) {
                    agg.maxRound = round;
                    agg.maxRoundSession = { round, accuracy };
                }
                
                // Max impact across all sessions - also track opponent info from this session
                if (impact > agg.maxImpact) {
                    agg.maxImpact = impact;
                    agg.opponentName = s.opponent_name || 'Unknown';
                    agg.opponentImpact = opponentImpact;
                }
            });

            const rows = Array.from(byProfile.values());
            
            // Create rounds leaderboard
            const roundsBoard = rows
                .map(r => ({ 
                    name: r.displayName,
                    originalName: r.originalName,
                    profileId: r.profileId,
                    maxRound: r.maxRound, 
                    accuracy: r.maxRoundSession ? r.maxRoundSession.accuracy : 0 
                }))
                .sort((a, b) => {
                    // Primary sort by max round, secondary by accuracy for ties
                    if (b.maxRound !== a.maxRound) return b.maxRound - a.maxRound;
                    return b.accuracy - a.accuracy;
                });

            // Create impact leaderboard
            const impactBoard = rows
                .map(r => ({ 
                    name: r.displayName,
                    originalName: r.originalName,
                    profileId: r.profileId,
                    impact: r.maxImpact,
                    opponentName: r.opponentName,
                    opponentImpact: r.opponentImpact
                }))
                .sort((a, b) => b.impact - a.impact);

            // Find user's ranks
            const roundsRank = roundsBoard.findIndex(player => 
                player.originalName === window.playerName
            ) + 1;

            const impactRank = impactBoard.findIndex(player => 
                player.originalName === window.playerName
            ) + 1;

            return {
                roundsRank: roundsRank > 0 ? roundsRank : null,
                impactRank: impactRank > 0 ? impactRank : null
            };
        } catch (error) {
            console.error('Error getting user ranks:', error);
            return { roundsRank: null, impactRank: null };
        }
    },

    async showCompletionModal() {
        const experimentContainer = document.getElementById('challenge-container');
        const completionModal = document.getElementById('completion-modal');
        const feedbackModal = document.getElementById('feedback-modal');
        const gameMenu = document.getElementById('game-menu');

        // Hide feedback modal first
        feedbackModal.classList.add('hidden');
        feedbackModal.classList.remove('fade-in');

        // Hide experiment container completely
        experimentContainer.classList.add('hidden');
        experimentContainer.classList.remove('fade-out');
        
        // Show the home page background (game menu)
        gameMenu.classList.remove('hidden');

        // Update the completion modal content immediately
        document.getElementById('final-accuracy').textContent = `${Math.round((this.state.correctDecisions / this.state.totalDecisions) * 100)}%`;
        document.getElementById('final-user-impact').textContent = `${this.state.userCumulativeEffect} cpd`;
        document.getElementById('final-opponent-impact').textContent = `${this.state.competitorCumulativeEffect} cpd`;
        // Calculate rounds completed: if they failed on current round, they completed currentRound - 1
        // If they're still in round 1 and failed, they completed 0 rounds
        const roundsCompleted = this.state.currentRound > 1 ? this.state.currentRound - 1 : 0;
        document.getElementById('final-round').textContent = roundsCompleted;

        // Show completion modal immediately to prevent flashing
        completionModal.classList.remove('hidden');
        setTimeout(() => {
            completionModal.classList.add('fade-in');
            // Submit score, end session, log event, and update final session summary
            (async () => {
                try {
                    if (typeof Backend !== 'undefined') {
                        await Backend.logEvent({
                            eventType: 'session_end',
                            roundNumber: this.state.currentRound,
                            payload: {
                                total_attempts: this.state.totalAttempts,
                                accuracy_pct: Math.round((this.state.correctDecisions / this.state.totalDecisions) * 100),
                                user_impact_cpd: this.state.userCumulativeEffect,
                                competitor_impact_cpd: this.state.competitorCumulativeEffect
                            }
                        });
                        // Final session summary update
                        const accuracy = this.state.totalDecisions > 0 ? 
                            Math.round((this.state.correctDecisions / this.state.totalDecisions) * 100) : 0;
                        await Backend.upsertSessionSummary({
                            maxRound: this.state.currentRound,
                            impactCpd: this.state.userCumulativeEffect,
                            accuracyPct: accuracy,
                            opponentName: this.state.selectedCompetitor,
                            opponentImpactCpd: this.state.competitorCumulativeEffect
                        });
                        await Backend.endSession();
                        
                        // Now calculate and display ranks after data is saved
                        const userRanks = await this.getUserRanks();
                        const playerName = window.playerName || 'Player';
                        const leaderboardUrl = `leaderboard.html?user=${encodeURIComponent(playerName)}`;
                        
                        if (userRanks.roundsRank) {
                            const roundsRankElement = document.getElementById('final-rounds-rank');
                            roundsRankElement.textContent = `#${userRanks.roundsRank}`;
                            roundsRankElement.href = leaderboardUrl;
                        } else {
                            const roundsRankElement = document.getElementById('final-rounds-rank');
                            roundsRankElement.textContent = '#?';
                            roundsRankElement.href = leaderboardUrl;
                        }
                        
                        if (userRanks.impactRank) {
                            const impactRankElement = document.getElementById('final-impact-rank');
                            impactRankElement.textContent = `#${userRanks.impactRank}`;
                            impactRankElement.href = leaderboardUrl;
                        } else {
                            const impactRankElement = document.getElementById('final-impact-rank');
                            impactRankElement.textContent = '#?';
                            impactRankElement.href = leaderboardUrl;
                        }
                    }
                } catch (err) {
                    console.error('Failed to finalize session with backend', err);
                }
            })();
        });
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
        experimentContainer.classList.remove('compact');

        // Reset state
        this.state.currentExperiment = 1;
        this.state.totalAttempts = 0;
        this.state.totalDecisions = 0;
        this.state.correctDecisions = 0;
        this.state.currentRound = 1; // Reset round number for new session
        this.state.experimentsInCurrentRound = 0;
        this.state.correctInCurrentRound = 0;
        this.state.impact = 0;
        this.state.userCumulativeEffect = 0;
        this.state.competitorCumulativeEffect = 0;
        this.state.currentCompetitor = null;
        this.state.selectedCompetitor = null;
        this.state.roundResults = []; // Reset round results
        this.updateExperimentDots(); // Update experiment dots for new session

        // Update displays
        this.updateAccuracyDisplay(0);
        this.updateRoundDisplay(); // Update the round display
        this.updateImpactDisplay(); // Update impact display

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
        const text = `I just completed the A/B Testing Gym challenge with ${Math.round((this.state.correctDecisions / this.state.totalDecisions) * 100)}% accuracy! Try it yourself!`;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`);
    },

    shareOnLinkedIn() {
        const text = `I just completed the A/B Testing Gym challenge with ${Math.round((this.state.correctDecisions / this.state.totalDecisions) * 100)}% accuracy! Try it yourself!`;
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}&summary=${encodeURIComponent(text)}`);
    },

    updateImpactDisplay() {
        document.getElementById('user-impact').textContent = `${this.state.userCumulativeEffect} cpd`;
        document.getElementById('opponent-impact').textContent = `${this.state.competitorCumulativeEffect} cpd`;
    },

    formatPercent(value) {
        return `${(value * 100).toFixed(1)}%`;
    },

    updateCompetitorName() {
        const competitorName = this.state.currentCompetitor.name;
        const competitorNameElement = document.getElementById('competitor-name');
        const finalCompetitorNameElement = document.getElementById('final-competitor-name');
        const modalCompetitorNameElement = document.getElementById('modal-competitor-name');
        
        if (competitorNameElement) {
            competitorNameElement.textContent = competitorName;
        }
        if (finalCompetitorNameElement) {
            finalCompetitorNameElement.textContent = competitorName;
        }
        if (modalCompetitorNameElement) {
            modalCompetitorNameElement.textContent = competitorName;
        }
    },

    updateExperimentDots() {
        const dot1 = document.getElementById('exp-dot-1');
        const dot2 = document.getElementById('exp-dot-2');
        const dot3 = document.getElementById('exp-dot-3');
        const dots = [dot1, dot2, dot3];
        
        // Reset all dots to gray
        dots.forEach(dot => {
            if (dot) {
                dot.className = 'w-3 h-3 rounded-full bg-gray-400 transition-colors duration-300 tooltip-trigger';
            }
        });
        
        // Update dots based on experiment results and current position
        for (let i = 0; i < 3; i++) {
            const dot = dots[i];
            if (!dot) continue;
            
            const experimentIndex = i; // 0-based index for experiments
            const result = this.state.roundResults[experimentIndex];
            const isCurrentExperiment = (i === this.state.experimentsInCurrentRound);
            const isFutureExperiment = (i > this.state.experimentsInCurrentRound);
            const experimentNumber = i + 1;
            
            // Update tooltip content
            const tooltipContent = dot.querySelector('.tooltip-content');
            
            if (result) {
                // Experiment is completed
                if (result.isPerfect || result.isGood) {
                    // Green for passed experiments
                    dot.className = 'w-3 h-3 rounded-full bg-green-500 transition-colors duration-300 tooltip-trigger';
                    if (tooltipContent) {
                        tooltipContent.textContent = `Experiment ${experimentNumber}: Passed`;
                    }
                } else {
                    // Red for failed experiments
                    dot.className = 'w-3 h-3 rounded-full bg-red-500 transition-colors duration-300 tooltip-trigger';
                    if (tooltipContent) {
                        tooltipContent.textContent = `Experiment ${experimentNumber}: Failed`;
                    }
                }
            } else if (isCurrentExperiment) {
                // Current experiment (not yet completed)
                dot.className = 'w-3 h-3 rounded-full bg-gray-400 transition-colors duration-300 tooltip-trigger';
                if (tooltipContent) {
                    tooltipContent.textContent = `Experiment ${experimentNumber}: In progress`;
                }
            } else if (isFutureExperiment) {
                // Future experiments
                dot.className = 'w-3 h-3 rounded-full bg-gray-400 transition-colors duration-300 tooltip-trigger';
                if (tooltipContent) {
                    tooltipContent.textContent = `Experiment ${experimentNumber}: Not started`;
                }
            }
        }
    },

    updateRoundTickMarks() {
        const feedbackIcon1 = document.getElementById('feedback-icon-1');
        const feedbackIcon2 = document.getElementById('feedback-icon-2');
        const feedbackIcon3 = document.getElementById('feedback-icon-3');
        const roundProgressText = document.getElementById('round-progress-text');
        
        // Update round progress text
        if (roundProgressText) {
            roundProgressText.textContent = `Round ${this.state.currentRound} Progress: ${this.state.correctInCurrentRound}/${this.state.experimentsInCurrentRound} correct`;
        }
        
        // Reset all icons to gray placeholder (empty circles)
        [feedbackIcon1, feedbackIcon2, feedbackIcon3].forEach(icon => {
            icon.className = 'flex items-center justify-center h-10 w-10 rounded-full bg-gray-200';
            icon.innerHTML = '';
        });
        
        // Update icons based on round results
        for (let i = 0; i < this.state.roundResults.length; i++) {
            const result = this.state.roundResults[i];
            const icon = [feedbackIcon1, feedbackIcon2, feedbackIcon3][i];
            const isCurrentExperiment = (i === this.state.experimentsInCurrentRound - 1);
            
            if (result) {
                if (result.isPerfect || result.isGood) {
                    // Green checkmark for any points scored (perfect or good)
                    const baseClass = 'flex items-center justify-center rounded-full bg-green-100';
                    const sizeClass = isCurrentExperiment ? 'h-12 w-12 border-2 border-green-600' : 'h-10 w-10';
                    icon.className = `${baseClass} ${sizeClass}`;
                    const iconSize = isCurrentExperiment ? 'h-6 w-6' : 'h-5 w-5';
                    icon.innerHTML = `<svg class="${iconSize} text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
                } else {
                    // Red X only when no points are scored (poor performance)
                    const baseClass = 'flex items-center justify-center rounded-full bg-red-100';
                    const sizeClass = isCurrentExperiment ? 'h-12 w-12 border-2 border-red-600' : 'h-10 w-10';
                    icon.className = `${baseClass} ${sizeClass}`;
                    const iconSize = isCurrentExperiment ? 'h-6 w-6' : 'h-5 w-5';
                    icon.innerHTML = `<svg class="${iconSize} text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
                }
            }
        }
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