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
        roundResults: [], // Store results for each experiment in the current round
        sessionStartPersonalBest: null, // Store personal best data at session start
        sessionStartRoundsRank: null, // Store starting rounds rank
        sessionStartImpactRank: null // Store starting impact rank
    },

    init() {
        this.initializeEventListeners();
        //this.initializeCheatSheet();
        this.initializeTabs();
        this.initializeGlobalTooltips();
        // Leaderboard moved to separate page; no refresh here
    },

    debugMode() {
        return document.getElementById('debug-mode').checked;
    },

    // Initialize all tooltips globally with consistent clickable behavior
    initializeGlobalTooltips() {
        const tooltipTriggers = document.querySelectorAll('.tooltip-trigger');
        tooltipTriggers.forEach(trigger => {
            this.initializeTooltip(trigger);
        });
    },

    // Protect against accidental refresh/close while a session is active
    enableUnloadProtection() {
        if (this._beforeUnloadHandler) return;
        this._beforeUnloadHandler = (e) => {
            e.preventDefault();
            // Setting returnValue triggers the browser's confirmation dialog
            e.returnValue = '';
            return '';
        };
        window.addEventListener('beforeunload', this._beforeUnloadHandler);
    },

    disableUnloadProtection() {
        if (!this._beforeUnloadHandler) return;
        window.removeEventListener('beforeunload', this._beforeUnloadHandler);
        this._beforeUnloadHandler = null;
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
                submitButton.disabled = false;
                submitButton.classList.remove('opacity-50', 'cursor-not-allowed');
                submitButton.classList.add('hover:opacity-90');
                submitButton.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" style="pointer-events: none;"><polygon points="8,5 8,19 19,12"/></svg>';

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
            // Save session summary with opponent data before ending session
            if (typeof Backend !== 'undefined' && Backend.isInitialized()) {
                // Log session end event with current data
                await Backend.logEvent({
                    eventType: 'session_end',
                    roundNumber: this.state.currentRound,
                    payload: {
                        total_attempts: this.state.totalAttempts,
                        accuracy_pct: this.state.totalDecisions > 0 ?
                            Math.round((this.state.correctDecisions / this.state.totalDecisions) * 100) : 0,
                        user_impact_cpd: this.state.userCumulativeEffect,
                        competitor_impact_cpd: this.state.competitorCumulativeEffect
                    }
                });

                // Save final session summary with opponent data
                const accuracy = this.state.totalDecisions > 0 ?
                    Math.round((this.state.correctDecisions / this.state.totalDecisions) * 100) : 0;
                await Backend.upsertSessionSummary({
                    maxRound: this.state.currentRound,
                    impactCpd: this.state.userCumulativeEffect,
                    accuracyPct: accuracy,
                    opponentName: this.state.selectedCompetitor,
                    opponentImpactCpd: this.state.competitorCumulativeEffect
                });

                // End the backend session
                await Backend.endSession();
            }
        } catch (error) {
            console.error('Error ending session:', error);
        }

        // Re-allow navigation once exiting
        this.disableUnloadProtection();

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
        this.updateAccuracyDisplay(0);
        this.updateImpactDisplay();
        this.resetDecisions();
        this.updateExperimentDots();
        this.updateRoundTickMarks();

        // Reset progress bar and clear globals
        const progressBar = document.getElementById('progress-bar');
        if (progressBar) {
            progressBar.style.width = '0%';
        }
        window.currentExperiment = null;
        window.currentAnalysis = null;
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

    async startSession() {
        // Always start from a clean slate, but keep selected opponent choice
        const preservedCompetitor = this.state.selectedCompetitor;
        this.resetGameState();
        this.state.selectedCompetitor = preservedCompetitor;

        // Fetch personal best data and starting rankings at session start (before any gameplay)
        console.log('Fetching personal best data and starting rankings at session start...');
        this.state.sessionStartPersonalBest = await this.getUserPersonalBest();
        const startingRanks = await this.getUserRanks();
        this.state.sessionStartRoundsRank = startingRanks.roundsRank;
        this.state.sessionStartImpactRank = startingRanks.impactRank;
        console.log('Session start data:', {
            personalBest: this.state.sessionStartPersonalBest,
            roundsRank: this.state.sessionStartRoundsRank,
            impactRank: this.state.sessionStartImpactRank
        });

        const gameMenu = document.getElementById('game-menu');
        const tutorialSection = document.getElementById('tutorial-section');
        const experimentContainer = document.getElementById('challenge-container');

        // Prevent accidental page refresh/close during gameplay
        this.enableUnloadProtection();

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
                2: [partialLoser().withVisitorsLoss(), partialLoser().withSampleRatioMismatch(), partialLoser().withBaseRateMismatch()],
                3: [slowCompletion(), fastWinner(), fastLoserWithPartialWeek()],
                4: [slowCompletion().withBaseRateMismatch(), fastLoserWithPartialWeek().withSampleRatioMismatch(), loser()],
                5: [partialWinner(), winner().withLowerIsBetter(), inconclusive()],
                6: [twymansLawTrap(), inconclusive(), fastLoserWithPartialWeek()],
                7: [partialWinner().withLowerIsBetter(), bigLoser().withLowerIsBetter(), loser().withLowerIsBetter()],
                8: [partialLoser().withSampleRatioMismatch(), winner(), loser().withLowerIsBetter()],
                9: [inconclusive().withOverdue(), winner(), inconclusive()],
                10: [winner().withUnderpoweredDesign(), winner(), twymansLawTrap().withBaseRateMismatch().withUnderpoweredDesign().withOverdue()]
            };

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

            // Ensure the execution bar always animates from 0 after content is visible
            setTimeout(() => {
                try {
                    this.animateExecutionBarFromZero();
                } catch (_) { }
            }, 20);

            return true;
        } catch (error) {
            console.error('Error loading challenge:', error);
            return false;
        }
    },

    animateExecutionBarFromZero() {
        const challenge = this.state.challenge;
        if (!challenge) return;
        const daysElapsed = challenge.simulation.timeline.currentRuntimeDays;
        const totalDays = challenge.experiment.requiredRuntimeDays;
        const progressPercent = Math.round((daysElapsed / totalDays) * 100);

        const progressBar = document.getElementById('exp-progress-bar');
        const progressBarInvisible = document.getElementById('exp-progress-bar-invisible');
        const remainingBar = document.getElementById('exp-remaining-bar');
        const remainingBarInvisible = document.getElementById('exp-remaining-bar-invisible');
        if (!progressBar || !progressBarInvisible || !remainingBar || !remainingBarInvisible) return;

        // Reset widths to start state without animating
        const prevTransitionsAE = [
            progressBar.style.transition,
            progressBarInvisible.style.transition,
            remainingBar.style.transition,
            remainingBarInvisible.style.transition
        ];
        progressBar.style.transition = 'none';
        progressBarInvisible.style.transition = 'none';
        remainingBar.style.transition = 'none';
        remainingBarInvisible.style.transition = 'none';

        progressBar.style.width = '0%';
        progressBarInvisible.style.width = '0%';
        remainingBar.style.width = '100%';
        remainingBarInvisible.style.width = '100%';

        // Force reflow so next change animates
        // eslint-disable-next-line no-unused-expressions
        progressBar.offsetHeight;

        // Restore transitions and animate to final widths
        progressBar.style.transition = prevTransitionsAE[0] || '';
        progressBarInvisible.style.transition = prevTransitionsAE[1] || '';
        remainingBar.style.transition = prevTransitionsAE[2] || '';
        remainingBarInvisible.style.transition = prevTransitionsAE[3] || '';

        const clampedProgress = Math.min(100, progressPercent);
        const clampedRemaining = Math.max(0, 100 - clampedProgress);

        requestAnimationFrame(() => {
            progressBar.style.width = `${clampedProgress}%`;
            progressBarInvisible.style.width = `${clampedProgress}%`;
            remainingBar.style.width = `${clampedRemaining}%`;
            remainingBarInvisible.style.width = `${clampedRemaining}%`;
        });
    },

    // Helper functions for consistent formatting
    formatDelta(value, isPercentage = false) {
        const sign = value > 0 ? '+' : '';
        return isPercentage ?
            `${sign}${(value * 100).toFixed(2)}%` :
            `${sign}${value}`;
    },

    formatUplift(value) {
        const sign = value > 0 ? '+' : '';
        return `${sign}${(value * 100).toFixed(2)}%`;
    },

    // Helper function to create a warning icon with tooltip
    createWarningIcon(message) {
        const warningIcon = document.createElement('span');
        warningIcon.className = 'text-yellow-500 cursor-help tooltip-trigger text-sm';
        warningIcon.textContent = '⚠️';

        const tooltipContent = document.createElement('span');
        tooltipContent.className = 'tooltip-content';
        tooltipContent.innerHTML = message.replace(/\n/g, '<br>');
        warningIcon.appendChild(tooltipContent);

        return warningIcon;
    },

    // Initialize tooltip for dynamically created elements
    initializeTooltip(tooltipTrigger) {
        let isTooltipVisible = false;
        let hideTimeout;
        
        const moveHandler = function () {
            const tip = tooltipTrigger.querySelector('.tooltip-content');
            if (!tip) return;

            const rect = tooltipTrigger.getBoundingClientRect();
            const tipHeight = tip.offsetHeight;
            const tipWidth = tip.offsetWidth;

            let left = rect.left + (rect.width / 2) - (tipWidth / 2);
            if (left < 10) left = 10;
            if (left + tipWidth > window.innerWidth - 10) {
                left = window.innerWidth - tipWidth - 10;
            }

            const spaceAbove = rect.top;
            const spaceBelow = window.innerHeight - rect.bottom;
            let top;
            if (spaceAbove >= tipHeight + 10) {
                top = rect.top - tipHeight - 10;
            } else if (spaceBelow >= tipHeight + 10) {
                top = rect.bottom + 10;
            } else {
                top = rect.bottom + 10;
            }

            tip.style.left = left + 'px';
            tip.style.top = top + 'px';
        };

        const showTooltip = function() {
            clearTimeout(hideTimeout);
            const tip = tooltipTrigger.querySelector('.tooltip-content');
            if (!tip) return;
            
            moveHandler();
            tip.style.visibility = 'visible';
            tip.style.opacity = '1';
            isTooltipVisible = true;
        };

        const hideTooltip = function() {
            if (isTooltipVisible) {
                hideTimeout = setTimeout(() => {
                    const tip = tooltipTrigger.querySelector('.tooltip-content');
                    if (!tip) return;
                    tip.style.visibility = 'hidden';
                    tip.style.opacity = '0';
                    tip.style.left = '-9999px';
                    tip.style.top = '-9999px';
                    isTooltipVisible = false;
                }, 200); // Much shorter delay
            }
        };

        const cancelHide = function() {
            clearTimeout(hideTimeout);
        };

        // Trigger events
        tooltipTrigger.addEventListener('mouseenter', showTooltip);
        tooltipTrigger.addEventListener('mousemove', moveHandler);
        tooltipTrigger.addEventListener('mouseleave', hideTooltip);
        
        // Tooltip content events - this is the key improvement
        const tip = tooltipTrigger.querySelector('.tooltip-content');
        if (tip) {
            tip.addEventListener('mouseenter', cancelHide);
            tip.addEventListener('mouseleave', hideTooltip);
            tip.addEventListener('mousemove', cancelHide);
            
            // Make links focusable and handle focus events
            const links = tip.querySelectorAll('a');
            links.forEach(link => {
                link.addEventListener('focus', cancelHide);
                link.addEventListener('blur', hideTooltip);
                link.addEventListener('mouseenter', cancelHide);
                link.addEventListener('mouseleave', hideTooltip);
            });
        }
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
        
        // Initialize tooltip for the newly created warning icon
        this.initializeTooltip(warningIcon);
    },

    clearAllAlerts() {
        // Clear base rate mismatch alert
        const baseRateCell = document.getElementById('base-rate');
        if (baseRateCell) {
            baseRateCell.textContent = baseRateCell.textContent.replace(/⚠️.*$/, '').trim();
        }
        
        // Clear sample size warnings
        const baseVisitorsCell = document.getElementById('base-visitors');
        const variantVisitorsCell = document.getElementById('variant-visitors');
        if (baseVisitorsCell) {
            baseVisitorsCell.textContent = baseVisitorsCell.textContent.replace(/⚠️.*$/, '').trim();
        }
        if (variantVisitorsCell) {
            variantVisitorsCell.textContent = variantVisitorsCell.textContent.replace(/⚠️.*$/, '').trim();
        }
        
        // Clear SRM alert
        const visitorsHeader = document.querySelector('.metrics-table th:nth-child(2)');
        if (visitorsHeader) {
            visitorsHeader.textContent = 'Visitors';
        }
        
        // Clear Twyman's Law alert
        const pValueElement = document.getElementById('p-value-display');
        if (pValueElement) {
            // Remove warning icons (tooltip-trigger elements)
            const warningIcons = pValueElement.querySelectorAll('.tooltip-trigger');
            warningIcons.forEach(icon => icon.remove());
        }
        
        // Clear overdue alert
        const completeTextElement = document.getElementById('exp-complete-text');
        if (completeTextElement) {
            // Remove warning icons but keep the original text
            const textNodes = Array.from(completeTextElement.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
            if (textNodes.length > 0) {
                completeTextElement.textContent = textNodes[0].textContent;
            }
        }
    },

    addDebugAlerts() {
        // Clear existing alerts first
        this.clearAllAlerts();
        
        this.addBaseConversionRateMissmatchAlert();
        this.addSampleSizeWarning();
        this.addSampleRatioMismatchAlert();
        this.addTwymansLawAlert();
        this.addOverdueAlert();
        this.addUnderpoweredDesignAlert();
    },

    addBaseConversionRateMissmatchAlert() {
        // Use time-filtered analysis if available, otherwise fall back to original analysis
        const analysis = window.currentTimeFilteredAnalysis || window.currentAnalysis;
        if (!analysis || !analysis.analysis) return;
        
        if (!analysis.analysis.hasBaseRateMismatch) return;

        const baseRateCell = document.getElementById('base-rate');
        const { expected, actual, difference, pValue } = analysis.analysis.baseRate;

        const message = `Design Base Rate: ${formatPercent(expected)}\nActual Base Rate: ${formatPercent(actual)}\nDifference: ${formatPercent(difference)}\np-value: ${pValue.toFixed(4)}\n\n<a href="base-rate-mismatch.html" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:text-blue-700">Learn more about base rate mismatches →</a>`;
        this.addWarningToCell(baseRateCell, message);
    },

    addSampleSizeWarning() {
        // Use time-filtered analysis if available, otherwise fall back to original analysis
        const analysis = window.currentTimeFilteredAnalysis || window.currentAnalysis;
        if (!analysis || !analysis.analysis) return;

        const hasInsufficientSampleSize = analysis.analysis.hasInsufficientSampleSize;
        if (!hasInsufficientSampleSize) return;

        // Get data from the time-filtered data source
        const dataSource = window.currentTimeFilteredData || window.currentAnalysis;
        if (!dataSource) return;

        const currentDay = dataSource.simulation.timeline.currentRuntimeDays;
        const requiredSampleSize = dataSource.experiment.requiredSampleSizePerVariant;
        const actualBase = dataSource.simulation.actualVisitorsBase;
        const actualVariant = dataSource.simulation.actualVisitorsVariant;
        
        // Check if we're at or past the planned end date
        const plannedEndDate = dataSource.experiment.requiredRuntimeDays;
        if (currentDay < plannedEndDate) return; // Only show warnings after planned end date

        // Check base variant
        if (actualBase < requiredSampleSize) {
            const message = `Insufficient sample size (${actualBase.toLocaleString()} < ${requiredSampleSize.toLocaleString()})\n\n<a href="sample-size-warning.html" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:text-blue-700">Learn more about sample size warnings →</a>`;
            this.addWarningToCell(document.getElementById('base-visitors'), message);
        }

        // Check variant
        if (actualVariant < requiredSampleSize) {
            const message = `Insufficient sample size (${actualVariant.toLocaleString()} < ${requiredSampleSize.toLocaleString()})\n\n<a href="sample-size-warning.html" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:text-blue-700">Learn more about sample size warnings →</a>`;
            this.addWarningToCell(document.getElementById('variant-visitors'), message);
        }

        // Check total sample size
        const totalVisitors = actualBase + actualVariant;
        const requiredTotal = requiredSampleSize * 2;

        if (totalVisitors < requiredTotal) {
            const completeTextElement = document.getElementById('exp-complete-text');
            const message = `Runtime Complete but Insufficient sample size: ${totalVisitors.toLocaleString()} < ${requiredTotal.toLocaleString()}\n\n<a href="sample-size-warning.html" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:text-blue-700">Learn more about sample size warnings →</a>`;

            completeTextElement.textContent = '';
            completeTextElement.appendChild(this.createWarningIcon(message));
            completeTextElement.appendChild(document.createTextNode(` Complete | ${currentDay}d | ${totalVisitors.toLocaleString()}v`));
        }
    },

    addSampleRatioMismatchAlert() {
        if (!this.debugMode()) return;

        // Use time-filtered analysis if available, otherwise fall back to original analysis
        const analysis = window.currentTimeFilteredAnalysis || window.currentAnalysis;
        if (!analysis || !analysis.analysis) return;

        const hasSignificantRatioMismatch = analysis.analysis.hasSignificantRatioMismatch;
        if (!hasSignificantRatioMismatch) return;

        const visitorsHeader = document.querySelector('.metrics-table th:nth-child(2)');
        if (!visitorsHeader) return;

        const message = `Sample Ratio Mismatch detected (p-value<0.0001)\n\n<a href="sample-ratio-mismatch.html" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:text-blue-700">Learn more about sample ratio mismatches →</a>`;

        visitorsHeader.textContent = '';
        visitorsHeader.appendChild(document.createTextNode('Visitors'));
        
        const warningIcon = this.createWarningIcon(message);
        visitorsHeader.appendChild(warningIcon);
        
        // Initialize tooltip for the newly created warning icon
        this.initializeTooltip(warningIcon);
    },

    addTwymansLawAlert() {
        // Use time-filtered analysis if available, otherwise fall back to original analysis
        const analysis = window.currentTimeFilteredAnalysis || window.currentAnalysis;
        if (!analysis || !analysis.analysis) {
            return;
        }

        const hasTwymansLaw = analysis.analysis.hasTwymansLaw;
        
        if (!hasTwymansLaw) {
            return;
        }

        const pValueElement = document.getElementById('p-value-display');
        if (!pValueElement) {
            return;
        }

        // Get p-value from the time-filtered data source
        const dataSource = window.currentTimeFilteredData || window.currentAnalysis;
        if (!dataSource) {
            return;
        }

        const pValue = dataSource.simulation.pValue;
        
        const message = `Twyman's Law detected: Suspiciously low p-value (p=${pValue.toFixed(10)}) and unusually large effect (more than 10 x the MRE)\n\n<a href="twymans-law.html" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:text-blue-700">Learn more about Twyman's Law →</a>`;
        // Use the proper warning cell helper function
        this.addWarningToCell(pValueElement, message);
    },

    addOverdueAlert() {
        const analysis = window.currentAnalysis;
        
        if (!analysis || !analysis.analysis || !analysis.analysis.overdue) {
            return;
        }

        const { isOverdue, originalRuntime, actualRuntime, extraDays } = analysis.analysis.overdue;
        
        if (!isOverdue) {
            return;
        }

        const completeTextElement = document.getElementById('exp-complete-text');
        if (!completeTextElement) {
            return;
        }
        
        // Get sample size information
        const originalExperiment = analysis.originalExperiment;
        const originalBaseVisitors = originalExperiment?.simulation?.actualVisitorsBase || 0;
        const originalVariantVisitors = originalExperiment?.simulation?.actualVisitorsVariant || 0;
        const originalTotalVisitors = originalBaseVisitors + originalVariantVisitors;
        const requiredSampleSize = originalExperiment?.experiment?.requiredSampleSizePerVariant || 0;
        const requiredTotalSampleSize = requiredSampleSize * 2;
        
        const message = `Overdue Experiment: Planned for ${originalRuntime} days but ran for ${actualRuntime} days (${extraDays} extra days)\n\nSample Size:\n• Intended: ${requiredTotalSampleSize.toLocaleString()} total (${requiredSampleSize.toLocaleString()} per variant)\n• Actual: ${originalTotalVisitors.toLocaleString()} total (${originalBaseVisitors.toLocaleString()} base, ${originalVariantVisitors.toLocaleString()} variant)\n<a href="overdue-experiment.html" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:text-blue-700">Learn more about overdue experiments →</a>`;

        // Clear the element completely and rebuild it
        completeTextElement.innerHTML = '';
        completeTextElement.textContent = '';
        
        // Remove any existing tooltip attributes to prevent conflicts
        completeTextElement.removeAttribute('title');
        completeTextElement.removeAttribute('data-tooltip');
        
        // Add warning icon with proper tooltip handling
        const warningIcon = this.createWarningIcon(message);
        completeTextElement.appendChild(warningIcon);
        
        // Add the complete text
        const completeText = document.createTextNode(` Complete | ${actualRuntime}d | ${analysis.originalExperiment?.simulation?.actualVisitorsBase + analysis.originalExperiment?.simulation?.actualVisitorsVariant || 'N/A'}v`);
        completeTextElement.appendChild(completeText);
        
        // Ensure the warning icon tooltip is properly isolated
        const tooltipContent = warningIcon.querySelector('.tooltip-content');
        if (tooltipContent) {
            // Remove any conflicting event listeners
            const newWarningIcon = warningIcon.cloneNode(true);
            completeTextElement.replaceChild(newWarningIcon, warningIcon);
        }
    },

    addUnderpoweredDesignAlert() {
        console.log('🔍 Checking underpowered design alert...');
        console.log('Debug mode:', this.debugMode());
        
        if (!this.debugMode()) {
            console.log('❌ Debug mode is disabled');
            return;
        }

        // Use time-filtered analysis if available, otherwise fall back to original analysis
        const analysis = window.currentTimeFilteredAnalysis || window.currentAnalysis;
        console.log('Analysis object:', analysis);
        
        if (!analysis || !analysis.analysis) {
            console.log('❌ No analysis object found');
            return;
        }

        const hasUnderpoweredDesign = analysis.analysis.hasUnderpoweredDesign;
        console.log('Has underpowered design:', hasUnderpoweredDesign);
        
        if (!hasUnderpoweredDesign) {
            console.log('❌ No underpowered design detected');
            return;
        }

        const underpoweredData = analysis.analysis.underpoweredDesign;
        console.log('Underpowered data:', underpoweredData);
        
        if (!underpoweredData) {
            console.log('❌ No underpowered data found');
            return;
        }

        // Find the sample size cell in the experiment design section
        const sampleSizeElement = document.getElementById('exp-required-sample');
        console.log('Sample size element:', sampleSizeElement);
        
        if (!sampleSizeElement) {
            console.log('❌ Sample size element not found');
            return;
        }

        console.log('✅ Adding underpowered design alert!');
        
        const message = `This sample size is not enough to reach the desired power of ${(underpoweredData.desiredPower * 100).toFixed(0)}% (power at this sample size is ${(underpoweredData.actualPower * 100).toFixed(0)}%)\n\nCorrect sample size to achieve ${(underpoweredData.desiredPower * 100).toFixed(0)}% power is  ${underpoweredData.correctSampleSize.toLocaleString()} per variant)\n\n<a href="sample-size-warning.html" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:text-blue-700">Learn more about sample size calculations →</a>`;

        // Clear the element and rebuild it with warning icon
        sampleSizeElement.textContent = '';
        
        // Add the original text back
        const textSpan = document.createElement('span');
        textSpan.textContent = underpoweredData.requiredSampleSize.toLocaleString();
        sampleSizeElement.appendChild(textSpan);
        
        // Add warning icon
        const warningIcon = this.createWarningIcon(message);
        sampleSizeElement.appendChild(warningIcon);
        
        // Initialize tooltip for the newly created warning icon
        this.initializeTooltip(warningIcon);
        
        console.log('✅ Underpowered design alert added successfully!');
    },

    initializeTimeSlider(displayChallenge) {
        const timeSlider = document.getElementById('time-slider');
        const currentTimeDisplay = document.getElementById('current-time-display');
        const totalTimeDisplay = document.getElementById('total-time-display');
        const timeSliderInfo = document.getElementById('time-slider-info');
        const plannedEndAnchor = document.getElementById('planned-end-anchor');
        
        if (!timeSlider || !displayChallenge) return;
        
        const maxDays = displayChallenge.simulation.timeline.currentRuntimeDays;
        const totalDays = displayChallenge.experiment.requiredRuntimeDays;
        
        // Set slider range
        timeSlider.min = 1;
        timeSlider.max = maxDays;
        timeSlider.value = maxDays; // Start at the end
        
        // Update current day display
        const currentDayDisplay = document.getElementById('current-day-display');
        if (currentDayDisplay) {
            currentDayDisplay.textContent = `Day ${maxDays}`;
        }
        
        
        
        // Remove any existing event listeners to prevent duplicates
        const newSlider = timeSlider.cloneNode(true);
        timeSlider.parentNode.replaceChild(newSlider, timeSlider);
        
        // Add event listener to the new slider
        newSlider.addEventListener('input', (e) => {
            const selectedDay = parseInt(e.target.value);
            this.updateExperimentAtTime(displayChallenge, selectedDay);
            
            // Update current day display
            if (currentDayDisplay) {
                currentDayDisplay.textContent = `Day ${selectedDay}`;
            }
        });
        
        // Add click handler for jump to today
        const jumpToToday = document.getElementById('jump-to-today');
        if (jumpToToday) {
            // Remove any existing event listeners
            const newJumpToToday = jumpToToday.cloneNode(true);
            jumpToToday.parentNode.replaceChild(newJumpToToday, jumpToToday);
            
            // Hide "Jump to Today" if planned end date is today (since they're the same)
            if (totalDays === maxDays) {
                newJumpToToday.style.display = 'none';
            } else {
                newJumpToToday.style.display = 'inline';
                
                newJumpToToday.addEventListener('click', (e) => {
                    e.preventDefault();
                    const todayDay = maxDays; // Today is the current runtime
                    
                    
                    // Update the slider value
                    newSlider.value = todayDay;
                    
                    // Trigger the slider's input event to ensure it moves
                    const inputEvent = new Event('input', { bubbles: true });
                    newSlider.dispatchEvent(inputEvent);
                    
                    // Update the experiment data
                    this.updateExperimentAtTime(displayChallenge, todayDay);
                    
                    // Update the day display
                    if (currentDayDisplay) {
                        currentDayDisplay.textContent = `Day ${todayDay}`;
                    }
                });
            }
        }
        
        // Add click handler for jump to planned end date (only show if planned end is in the past or today)
        const jumpToPlannedEnd = document.getElementById('jump-to-planned-end');
        const plannedEndFutureText = document.getElementById('planned-end-future-text');
        
        if (jumpToPlannedEnd && plannedEndFutureText) {
            // Remove any existing event listeners
            const newJumpToPlannedEnd = jumpToPlannedEnd.cloneNode(true);
            jumpToPlannedEnd.parentNode.replaceChild(newJumpToPlannedEnd, jumpToPlannedEnd);
            
            // Show the link if the planned end date is in the past or today (regardless of sample size)
            if (totalDays <= maxDays) {
                newJumpToPlannedEnd.style.display = 'inline';
                plannedEndFutureText.style.display = 'none';
                
                // Update link text based on whether planned end is today
                if (totalDays === maxDays) {
                    newJumpToPlannedEnd.textContent = 'Jump to Planned End Date (today)';
                } else {
                    newJumpToPlannedEnd.textContent = 'Jump to planned end date';
                }
                
                newJumpToPlannedEnd.addEventListener('click', (e) => {
                    e.preventDefault();
                    const plannedEndDay = totalDays;
                    
                    
                    // Update the slider value
                    newSlider.value = plannedEndDay;
                    
                    // Trigger the slider's input event to ensure it moves
                    const inputEvent = new Event('input', { bubbles: true });
                    newSlider.dispatchEvent(inputEvent);
                    
                    // Update the experiment data
                    this.updateExperimentAtTime(displayChallenge, plannedEndDay);
                    
                    // Update the day display
                    if (currentDayDisplay) {
                        currentDayDisplay.textContent = `Day ${plannedEndDay}`;
                    }
                });
            } else {
                newJumpToPlannedEnd.style.display = 'none';
                plannedEndFutureText.style.display = 'inline';
            }
        }
        
        // Add click handler for jump to last full week cycle
        const jumpToLastFullWeek = document.getElementById('jump-to-last-full-week');
        if (jumpToLastFullWeek) {
            console.log('Found jump-to-last-full-week element');
            const newJumpToLastFullWeek = jumpToLastFullWeek.cloneNode(true);
            jumpToLastFullWeek.parentNode.replaceChild(newJumpToLastFullWeek, jumpToLastFullWeek);

            newJumpToLastFullWeek.addEventListener('click', (e) => {
                console.log('Jump to last full week clicked!');
                e.preventDefault();
                // Prefer using timeline periods to find last full week boundary
                const timePoints = displayChallenge?.simulation?.timeline?.timePoints || [];
                let targetDay = 1;
                for (const tp of timePoints) {
                    const end = tp?.period?.endDay;
                    if (typeof end === 'number' && end <= maxDays && end % 7 === 0) {
                        if (end > targetDay) targetDay = end;
                    }
                }
                if (targetDay < 1) {
                    targetDay = 1;
                }
                // Fallback to mathematical boundary if no period matched
                if (targetDay === 1 && maxDays > 1) {
                    targetDay = Math.floor(maxDays / 7) * 7;
                    if (targetDay < 1) targetDay = 1;
                }

                console.log('Target day:', targetDay, 'Max days:', maxDays);

                // Update the slider value
                newSlider.value = targetDay;
                // Trigger the slider's input event to ensure it moves
                const inputEvent = new Event('input', { bubbles: true });
                newSlider.dispatchEvent(inputEvent);
                // Update the experiment data
                this.updateExperimentAtTime(displayChallenge, targetDay);
                // Update the day display
                if (currentDayDisplay) {
                    currentDayDisplay.textContent = `Day ${targetDay}`;
                }
            });
        } else {
            console.log('jump-to-last-full-week element not found');
        }
        
        // Initialize with current state
        this.updateExperimentAtTime(displayChallenge, maxDays);
    },

    getTimeFilteredData(displayChallenge, selectedDay) {
        const timePoints = displayChallenge.simulation.timeline.timePoints;
        
        // Find the timeline point for the selected day
        let point = timePoints.find(tp => tp.period.startDay <= selectedDay && tp.period.endDay >= selectedDay);
        if (!point) {
            // Fallback to the last point that ended before or on the selected day
            point = [...timePoints].reverse().find(tp => tp.period.endDay <= selectedDay);
        }
        
        if (!point) {
            console.warn('No timeline point found for day:', selectedDay);
            return null;
        }
        
        // Calculate p-value and confidence interval for the time-filtered data
        const { pValue } = window.computeTTest(
            point.base.cumulativeConversions,
            point.base.cumulativeVisitors,
            point.variant.cumulativeConversions,
            point.variant.cumulativeVisitors
        );
        
        
        // Use the calculated p-value directly (0 is a valid p-value)
        const validPValue = pValue;
        
        const confidenceIntervalDifference = window.computeDifferenceConfidenceInterval(
            point.base.cumulativeVisitors > 0 ? point.base.cumulativeConversions / point.base.cumulativeVisitors : 0,
            point.variant.cumulativeVisitors > 0 ? point.variant.cumulativeConversions / point.variant.cumulativeVisitors : 0,
            point.base.cumulativeVisitors,
            point.variant.cumulativeVisitors,
            displayChallenge.experiment.alpha
        );
        
        // Create a time-filtered experiment object with data from the selected day
        const timeFilteredExperiment = {
            ...displayChallenge,
            simulation: {
                ...displayChallenge.simulation,
                actualVisitorsBase: point.base.cumulativeVisitors,
                actualVisitorsVariant: point.variant.cumulativeVisitors,
                actualConversionsBase: point.base.cumulativeConversions,
                actualConversionsVariant: point.variant.cumulativeConversions,
                pValue: validPValue,
                confidenceIntervalDifference: confidenceIntervalDifference,
                baseConversionRate: point.base.cumulativeVisitors > 0 ? point.base.cumulativeConversions / point.base.cumulativeVisitors : 0,
                variantConversionRate: point.variant.cumulativeVisitors > 0 ? point.variant.cumulativeConversions / point.variant.cumulativeVisitors : 0,
                actualEffectSize: point.actualEffectSize,
                timeline: {
                    ...displayChallenge.simulation.timeline,
                    currentRuntimeDays: selectedDay
                }
            },
            experiment: {
                ...displayChallenge.experiment,
                // Ensure minimumRelevantEffect is preserved for Twyman's Law detection
                minimumRelevantEffect: displayChallenge.experiment.minimumRelevantEffect
            }
        };
        
        return timeFilteredExperiment;
    },

    updateExperimentAtTime(displayChallenge, selectedDay) {
        const timePoints = displayChallenge.simulation.timeline.timePoints;
        
        // Store the current time-filtered data globally for alerts to use
        window.currentTimeFilteredData = this.getTimeFilteredData(displayChallenge, selectedDay);
        
        // Create a time-filtered experiment and analyze it
        const timeFilteredExperiment = this.getTimeFilteredData(displayChallenge, selectedDay);
        if (timeFilteredExperiment) {
            window.currentTimeFilteredAnalysis = window.analyzeExperiment(timeFilteredExperiment);
        }
        
        // Find the timeline point for the selected day
        // Look for the point that contains the selected day (startDay <= selectedDay <= endDay)
        let point = timePoints.find(tp => tp.period.startDay <= selectedDay && tp.period.endDay >= selectedDay);
        
        // If no point contains the selected day, find the last point that ended before or on the selected day
        if (!point) {
            point = [...timePoints].reverse().find(tp => tp.period.endDay <= selectedDay);
        }
        
        if (!point) {
            return;
        }
        
        
        // Update UI components (except execution bar - it always shows full data)
        this.updateMetricsAtTime(point, selectedDay);
        this.updateResultsTableAtTime(point, selectedDay);
        this.updatePValueSectionAtTime(point, selectedDay);
        this.updateConfidenceIntervalsAtTime(point, selectedDay);
        
        // Refresh alerts with time-filtered analysis
        this.addDebugAlerts();
    },

    updateMetricsAtTime(point, selectedDay) {
        // Update base metrics
        const baseVisitorsElement = document.getElementById('base-visitors');
        const baseConversionsElement = document.getElementById('base-conversions');
        const baseRateElement = document.getElementById('base-rate');
        
        if (baseVisitorsElement) baseVisitorsElement.textContent = point.base.cumulativeVisitors.toLocaleString();
        if (baseConversionsElement) baseConversionsElement.textContent = point.base.cumulativeConversions.toLocaleString();
        if (baseRateElement) baseRateElement.textContent = (point.base.cumulativeRate * 100).toFixed(2) + '%';
        
        // Update variant metrics
        const variantVisitorsElement = document.getElementById('variant-visitors');
        const variantConversionsElement = document.getElementById('variant-conversions');
        const variantRateElement = document.getElementById('variant-rate');
        
        if (variantVisitorsElement) variantVisitorsElement.textContent = point.variant.cumulativeVisitors.toLocaleString();
        if (variantConversionsElement) variantConversionsElement.textContent = point.variant.cumulativeConversions.toLocaleString();
        if (variantRateElement) variantRateElement.textContent = (point.variant.cumulativeRate * 100).toFixed(2) + '%';
        
        // Update difference metrics
        const differenceElement = document.getElementById('difference');
        const upliftElement = document.getElementById('uplift');
        
        if (differenceElement) {
            const diff = point.difference.cumulativeRate;
            differenceElement.textContent = (diff * 100).toFixed(2) + '%';
        }
        
        if (upliftElement) {
            const uplift = point.uplift.cumulativeRate;
            upliftElement.textContent = (uplift * 100).toFixed(2) + '%';
        }
        
        // Update p-value (recalculate for this point in time)
        this.updatePValueAtTime(point);
    },

    updatePValueAtTime(point) {
        const pValueElement = document.getElementById('p-value-display');
        if (!pValueElement) return;
        
        // Calculate p-value for this point in time
        const { pValue } = computeTTest(
            point.base.cumulativeConversions,
            point.base.cumulativeVisitors,
            point.variant.cumulativeConversions,
            point.variant.cumulativeVisitors
        );
        
        pValueElement.textContent = pValue.toFixed(4);
    },

    updateResultsTableAtTime(point, selectedDay) {
        // Use the class formatting methods for consistency
        
        // Update base metrics
        const baseVisitorsElement = document.getElementById('base-visitors');
        const baseConversionsElement = document.getElementById('base-conversions');
        const baseRateElement = document.getElementById('base-rate');
        
        if (baseVisitorsElement) {
            baseVisitorsElement.textContent = point.base.cumulativeVisitors;
        }
        if (baseConversionsElement) {
            baseConversionsElement.textContent = point.base.cumulativeConversions;
        }
        if (baseRateElement) {
            baseRateElement.textContent = `${(point.base.cumulativeRate * 100).toFixed(2)}%`;
        }
        
        // Update variant metrics
        const variantVisitorsElement = document.getElementById('variant-visitors');
        const variantConversionsElement = document.getElementById('variant-conversions');
        const variantRateElement = document.getElementById('variant-rate');
        
        if (variantVisitorsElement) {
            variantVisitorsElement.textContent = point.variant.cumulativeVisitors;
        }
        if (variantConversionsElement) {
            variantConversionsElement.textContent = point.variant.cumulativeConversions;
        }
        if (variantRateElement) {
            variantRateElement.textContent = `${(point.variant.cumulativeRate * 100).toFixed(2)}%`;
        }
        
        // Update delta metrics
        const deltaVisitorsElement = document.getElementById('delta-visitors');
        const deltaConversionsElement = document.getElementById('delta-conversions');
        const deltaRateElement = document.getElementById('delta-rate');
        
        if (deltaVisitorsElement) {
            const deltaVisitors = point.variant.cumulativeVisitors - point.base.cumulativeVisitors;
            deltaVisitorsElement.textContent = this.formatDelta(deltaVisitors);
        }
        if (deltaConversionsElement) {
            const deltaConversions = point.variant.cumulativeConversions - point.base.cumulativeConversions;
            deltaConversionsElement.textContent = this.formatDelta(deltaConversions);
        }
        if (deltaRateElement) {
            const deltaRate = point.variant.cumulativeRate - point.base.cumulativeRate;
            deltaRateElement.textContent = this.formatDelta(deltaRate, true);
        }
        
        // Update uplift metrics
        const visitorUpliftElement = document.getElementById('visitor-uplift');
        const conversionUpliftElement = document.getElementById('conversion-uplift');
        const upliftValueElement = document.getElementById('uplift-value');
        
        if (visitorUpliftElement) {
            const visitorUplift = point.base.cumulativeVisitors > 0 ? 
                (point.variant.cumulativeVisitors - point.base.cumulativeVisitors) / point.base.cumulativeVisitors : 0;
            visitorUpliftElement.textContent = this.formatUplift(visitorUplift);
        }
        if (conversionUpliftElement) {
            const conversionUplift = point.base.cumulativeConversions > 0 ? 
                (point.variant.cumulativeConversions - point.base.cumulativeConversions) / point.base.cumulativeConversions : 0;
            conversionUpliftElement.textContent = this.formatUplift(conversionUplift);
        }
        if (upliftValueElement) {
            const upliftValue = point.base.cumulativeRate > 0 ? 
                (point.variant.cumulativeRate - point.base.cumulativeRate) / point.base.cumulativeRate : 0;
            upliftValueElement.textContent = this.formatUplift(upliftValue);
        }
    },

    updatePValueSectionAtTime(point, selectedDay) {
        // Update the p-value section with recalculated values
        const pValueElement = document.getElementById('p-value-display');
        if (!pValueElement) return;
        
        // Calculate p-value for this point in time
        const { pValue } = computeTTest(
            point.base.cumulativeConversions,
            point.base.cumulativeVisitors,
            point.variant.cumulativeConversions,
            point.variant.cumulativeVisitors
        );
        
        // Update p-value display
        pValueElement.textContent = pValue.toFixed(4);
        
        // Update significance indicator
        const alpha = window.currentExperiment?.experiment?.alpha || 0.05;
        const isSignificant = pValue < alpha;
        
        // Update significance styling
        if (isSignificant) {
            pValueElement.classList.add('text-green-600', 'font-bold');
            pValueElement.classList.remove('text-red-600');
        } else {
            pValueElement.classList.add('text-red-600');
            pValueElement.classList.remove('text-green-600', 'font-bold');
        }
    },

    updateConfidenceIntervalsAtTime(point, selectedDay) {
        
        // Calculate p-value for this point
        const { pValue } = computeTTest(
            point.base.cumulativeConversions,
            point.base.cumulativeVisitors,
            point.variant.cumulativeConversions,
            point.variant.cumulativeVisitors
        );
        
        // Calculate uplift for this point
        const uplift = point.uplift.cumulativeRate;
        const upliftCI = point.uplift.cumulativeRateCI;
        
        // Create a temporary challenge object with the point data for CI calculation
        // Use the same structure as the original experiment to ensure consistent CI rendering
        const tempChallenge = {
            ...window.currentExperiment,
            simulation: {
                ...window.currentExperiment.simulation,
                baseConversionRate: point.base.cumulativeRate,
                variantConversionRate: point.variant.cumulativeRate,
                confidenceIntervalBase: point.base.cumulativeRateCI,
                confidenceIntervalVariant: point.variant.cumulativeRateCI,
                confidenceIntervalDifference: point.difference.cumulativeRateCI,
                pValue: pValue,
                uplift: uplift,
                upliftConfidenceInterval: upliftCI
            }
        };
        
        
        // Use the standard CI update function for all experiments (overdue and normal)
        // This ensures consistent CI bar rendering regardless of experiment type
        if (window.updateConfidenceIntervals) {
            window.updateConfidenceIntervals(tempChallenge);
        } else {
        }
        
        // Refresh alerts with time-filtered data
        if (this.debugMode()) {
            this.addDebugAlerts();
        }
    },


    // Attach tooltip behaviour to dynamically added elements
    initializeTooltipTriggers(parent) {
        if (!parent) return;
        const triggers = parent.querySelectorAll('.tooltip-trigger');
        triggers.forEach(trigger => {
            this.initializeTooltip(trigger);
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

        // Update tooltip with prior estimate explanation and CI from experiment data
        const priorCI = challenge.experiment.priorEstimateCI;
        const [ciLow, ciHigh] = priorCI.confidenceInterval;
        const confidenceLevel = ((1 - challenge.experiment.dataQualityAlpha) * 100).toFixed(2);
        const tooltipContent = `Prior estimate from one month before experiment start (n=${priorCI.sampleSize.toLocaleString()}, ${confidenceLevel}% CI: ${(ciLow * 100).toFixed(2)}% - ${(ciHigh * 100).toFixed(2)}%)`;
        document.getElementById('base-rate-tooltip').textContent = tooltipContent;

        // Update conversion rates tab header if there's data loss
        if (this.debugMode() && window.currentAnalysis?.analysis?.hasDataLoss) {
            const conversionTab = document.querySelector('[data-tab="conversion"]');
            if (conversionTab) {
                conversionTab.innerHTML = `
                    <span class="tooltip-trigger">
                        Conversion Rate ⚠️
                        <span class="tooltip-content">
                            Data loss detected in experiment data
                            <br><a href="data-loss-alert.html" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:text-blue-700">Learn more about data loss →</a>
                        </span>
                    </span>
                `;
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

        // Check if this is an overdue experiment - if so, don't show tooltip (overdue alert handles this)
        const isOverdue = window.currentAnalysis?.analysis?.overdue?.isOverdue || false;
        if (isOverdue) {
            return; // No tooltip for overdue experiments
        }

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
            const mousemoveHandler = function (e) {
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
        
        // For overdue experiments, use original experiment data for display
        const displayChallenge = window.currentAnalysis?.originalExperiment || challenge;
        const daysElapsed = displayChallenge.simulation.timeline.currentRuntimeDays;
        const totalDays = displayChallenge.experiment.requiredRuntimeDays;
        
        // Initialize time slider
        this.initializeTimeSlider(displayChallenge);
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
        const totalVisitors = displayChallenge.simulation.actualVisitorsBase + displayChallenge.simulation.actualVisitorsVariant;
        const requiredVisitors = challenge.experiment.requiredSampleSizePerVariant * 2;
        const remainingVisitors = Math.max(0, requiredVisitors - totalVisitors);

        // Update bar widths - always animate from 0
        const prevTransitionsUE = [
            progressBar.style.transition,
            progressBarInvisible.style.transition,
            remainingBar.style.transition,
            remainingBarInvisible.style.transition
        ];
        progressBar.style.transition = 'none';
        progressBarInvisible.style.transition = 'none';
        remainingBar.style.transition = 'none';
        remainingBarInvisible.style.transition = 'none';

        progressBar.style.width = '0%';
        progressBarInvisible.style.width = '0%';
        remainingBar.style.width = '100%';
        remainingBarInvisible.style.width = '100%';

        // Force reflow to ensure animation restarts even if percentage is unchanged
        // eslint-disable-next-line no-unused-expressions
        progressBar.offsetHeight;

        // Restore transitions and animate to target in next frame
        progressBar.style.transition = prevTransitionsUE[0] || '';
        progressBarInvisible.style.transition = prevTransitionsUE[1] || '';
        remainingBar.style.transition = prevTransitionsUE[2] || '';
        remainingBarInvisible.style.transition = prevTransitionsUE[3] || '';

        requestAnimationFrame(() => {
            const clampedProgress = Math.min(100, progressPercent);
            const clampedRemaining = Math.max(0, 100 - clampedProgress);

            progressBar.style.width = `${clampedProgress}%`;
            progressBarInvisible.style.width = `${clampedProgress}%`;
            remainingBar.style.width = `${clampedRemaining}%`;
            remainingBarInvisible.style.width = `${clampedRemaining}%`;
        });

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
        
        // Check if this is an overdue experiment
        const isOverdue = window.currentAnalysis?.analysis?.overdue?.isOverdue || false;

        // Set progress bar color based on conditions
        if (isOverdue || (hasEnoughSampleSize && isFullWeek)) {
            // Bright blue for overdue experiments OR complete weeks with enough sample size
            progressBar.style.backgroundColor = '#3b82f6'; // Tailwind blue-500
        } else {
            // Gray for incomplete weeks or insufficient sample size
            progressBar.style.backgroundColor = '#9ca3af'; // Tailwind gray-400
        }

        // Update text content
        if (isComplete) {
            completeText.classList.remove('hidden');
            completeText.textContent = `Complete | ${daysElapsed}d | ${totalVisitors}v`;
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

        // Update base metrics
        document.getElementById('base-visitors').textContent = challenge.simulation.actualVisitorsBase;
        document.getElementById('base-conversions').textContent = challenge.simulation.actualConversionsBase;
        document.getElementById('base-rate').textContent = `${(challenge.simulation.baseConversionRate * 100).toFixed(2)}%`;


        // Update variant metrics
        document.getElementById('variant-visitors').textContent = challenge.simulation.actualVisitorsVariant;
        document.getElementById('variant-conversions').textContent = challenge.simulation.actualConversionsVariant;
        document.getElementById('variant-rate').textContent = `${(challenge.simulation.variantConversionRate * 100).toFixed(2)}%`;

        // Update delta metrics
        document.getElementById('delta-visitors').textContent = this.formatDelta(challenge.simulation.actualVisitorsVariant - challenge.simulation.actualVisitorsBase);
        document.getElementById('delta-conversions').textContent = this.formatDelta(challenge.simulation.actualConversionsVariant - challenge.simulation.actualConversionsBase);
        document.getElementById('delta-rate').textContent = this.formatDelta(challenge.simulation.variantConversionRate - challenge.simulation.baseConversionRate, true);

        // Update uplift metrics
        document.getElementById('visitor-uplift').textContent = this.formatUplift(challenge.simulation.visitorUplift);
        document.getElementById('conversion-uplift').textContent = this.formatUplift(challenge.simulation.conversionUplift);
        document.getElementById('uplift-value').textContent = this.formatUplift(challenge.simulation.uplift);
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
            
            // For overdue experiments, use the filtered experiment data for scoring
            let experiment = window.currentExperiment;
            if (analysis?.analysis?.overdue?.isOverdue) {
                // For overdue experiments, the analysis contains the filtered data
                // Create a proper experiment object with the filtered data for scoring
                experiment = {
                    experiment: window.currentExperiment.experiment,
                    simulation: {
                        actualVisitorsBase: analysis.simulation?.actualVisitorsBase || window.currentExperiment.simulation.actualVisitorsBase,
                        actualVisitorsVariant: analysis.simulation?.actualVisitorsVariant || window.currentExperiment.simulation.actualVisitorsVariant,
                        actualConversionsBase: analysis.simulation?.actualConversionsBase || window.currentExperiment.simulation.actualConversionsBase,
                        actualConversionsVariant: analysis.simulation?.actualConversionsVariant || window.currentExperiment.simulation.actualConversionsVariant,
                        pValue: analysis.simulation?.pValue || window.currentExperiment.simulation.pValue,
                        confidenceIntervalDifference: analysis.simulation?.confidenceIntervalDifference || window.currentExperiment.simulation.confidenceIntervalDifference,
                        actualEffectSize: analysis.simulation?.actualEffectSize || window.currentExperiment.simulation.actualEffectSize,
                        baseConversionRate: analysis.simulation?.baseConversionRate || window.currentExperiment.simulation.baseConversionRate,
                        variantConversionRate: analysis.simulation?.variantConversionRate || window.currentExperiment.simulation.variantConversionRate,
                        // Add timeline data for competitor decisions
                        timeline: {
                            currentRuntimeDays: analysis.simulation?.timeline?.currentRuntimeDays || window.currentExperiment.simulation.timeline.currentRuntimeDays,
                            timePoints: analysis.simulation?.timeline?.timePoints || window.currentExperiment.simulation.timeline.timePoints
                        }
                    }
                };
            }


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
            const summaryDisplay = document.getElementById('summary-display');

            // Create the results card title with round and experiment info
            const resultsCardTitleText = `Round ${this.state.currentRound}, Experiment ${this.state.experimentsInCurrentRound}`;

            // Populate summary block (compact, plain text aligned with content)
            if (summaryDisplay) {
                summaryDisplay.innerHTML = `
                    <div class="px-2 text-gray-800 text-sm leading-tight">${analysis.decision.summary || ''}</div>
                `;
            }

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


        if (accuracyElement) {
            accuracyElement.textContent = `${accuracy}%`;
        } else {
            console.error('Accuracy element not found!');
        }
        if (modalAccuracyElement) {
            modalAccuracyElement.textContent = `${accuracy}%`;
        }
    },

    updateRoundDisplay() {
        const roundElement = document.getElementById('current-round');
        if (roundElement) {
            roundElement.textContent = this.state.currentRound;
        }
    },

    async handleNextChallenge() {

        const feedbackModal = document.getElementById('feedback-modal');
        const nextChallengeBtn = document.getElementById('next-challenge-btn');

        ModalManager.hide('feedback-modal');

        if (this.state.experimentsInCurrentRound === this.state.EXPERIMENTS_PER_SESSION) {

            if (this.state.correctInCurrentRound >= 2) {
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
                                accuracyPct: accuracy,
                                opponentName: this.state.selectedCompetitor,
                                opponentImpactCpd: this.state.competitorCumulativeEffect
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
        const splash = document.getElementById('round-splash');
        const overlay = document.getElementById('round-splash-overlay');
        if (!splash || !overlay) {
            return;
        }

        // Use the same roundCaptions object as defined in loadChallenge()
        const roundCaptions = {
            1: "Warm Up!",
            2: "Let's Begin!",
            3: "Shocking: Tuesdays are not Sundays.",
            4: "Analysis Paralysis: Begin!",
            5: "Fact: Peeking increases Power.",
            6: "SRM: Because math hates you.",
            7: "Inconclusive? Call it a learning.",
            8: "Correlation is faster than causation.",
            9: "One does not simply report observed effects."
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
                
                // Also store opponent data if this is the first session (maxImpact is still 0)
                if (agg.maxImpact === 0 && impact >= 0) {
                    agg.opponentName = s.opponent_name || 'Unknown';
                    agg.opponentImpact = opponentImpact;
                }
            });

            const rows = Array.from(byProfile.values());

            // Create rounds leaderboard - filter out players with no sessions
            const roundsBoard = rows
                .filter(r => r.opponentName !== null) // Filter out players with no sessions
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

            // Create impact leaderboard - filter out players with no sessions
            const impactBoard = rows
                .filter(r => r.opponentName !== null) // Filter out players with no sessions
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

    async getUserPersonalBest() {
        try {
            if (typeof Backend === 'undefined' || !Backend.isInitialized()) {
                return { bestRound: 0, bestAccuracy: 0, bestImpact: 0 };
            }

            const client = Backend.getClient();
            const { data: summaries, error } = await client
                .from('session_summaries')
                .select('max_round_reached, total_impact_cpd, accuracy_pct')
                .eq('profile_id', Backend.getProfileId());

            if (error) throw error;
            if (!summaries || summaries.length === 0) {
                return { bestRound: 0, bestAccuracy: 0, bestImpact: 0 };
            }

            let bestRound = 0;
            let bestAccuracy = 0;
            let bestImpact = 0;
            let bestRoundSession = null;

            summaries.forEach(s => {
                const round = Number(s.max_round_reached) || 0;
                const accuracy = Number(s.accuracy_pct) || 0;
                const impact = Number(s.total_impact_cpd) || 0;

                // Track best round and accuracy from that session (like leaderboard)
                if (round > bestRound) {
                    bestRound = round;
                    bestRoundSession = { round, accuracy };
                }
                
                // Track best impact across all sessions
                bestImpact = Math.max(bestImpact, impact);
            });
            
            // Set accuracy from the session with highest round (like leaderboard)
            bestAccuracy = bestRoundSession ? bestRoundSession.accuracy : 0;

            console.log('Personal best data:', { bestRound, bestAccuracy, bestImpact, summariesCount: summaries.length });
            return { bestRound, bestAccuracy, bestImpact };

        } catch (err) {
            console.error('Failed to get personal best', err);
            return { bestRound: 0, bestAccuracy: 0, bestImpact: 0 };
        }
    },

    async showCompletionModal() {
        const experimentContainer = document.getElementById('challenge-container');
        const completionModal = document.getElementById('completion-modal');
        const feedbackModal = document.getElementById('feedback-modal');
        const gameMenu = document.getElementById('game-menu');

        // Re-allow navigation/refresh once the session completes
        this.disableUnloadProtection();

        // Hide feedback modal first
        feedbackModal.classList.add('hidden');
        feedbackModal.classList.remove('fade-in');

        // Hide experiment container completely
        experimentContainer.classList.add('hidden');
        experimentContainer.classList.remove('fade-out');

        // Show the home page background (game menu)
        gameMenu.classList.remove('hidden');

        // Update the completion modal content immediately
        const accuracy = this.state.totalDecisions > 0 ? 
            Math.round((this.state.correctDecisions / this.state.totalDecisions) * 100) : 0;
        document.getElementById('final-accuracy').textContent = this.state.totalDecisions > 0 ? `${accuracy}%` : '-';
        document.getElementById('final-user-impact').textContent = `${this.state.userCumulativeEffect} cpd`;
        document.getElementById('final-opponent-impact').textContent = `${this.state.competitorCumulativeEffect} cpd`;
        // Calculate rounds completed: if they failed on current round, they completed currentRound - 1
        // If they're still in round 1 and failed, they completed 0 rounds
        const roundsCompleted = this.state.currentRound > 1 ? this.state.currentRound - 1 : 0;
        // Show round reached (completed rounds + 1)
        const roundReached = roundsCompleted + 1;
        document.getElementById('final-round').textContent = roundReached;
        
        // Set player name
        const playerName = window.playerName || 'Player';
        document.getElementById('final-player-name').textContent = playerName;

        // Show completion modal immediately to prevent flashing
        completionModal.classList.remove('hidden');
        setTimeout(() => {
            completionModal.classList.add('fade-in');
            // Use personal best data captured at session start
            (async () => {
                try {
                    // Use personal best data captured at session start
                    console.log('Using personal best data from session start...');
                    const personalBest = this.state.sessionStartPersonalBest || { bestRound: 0, bestAccuracy: 0, bestImpact: 0 };
                    console.log('Personal best data from session start:', personalBest);
                    
                    const currentAccuracy = this.state.totalDecisions > 0 ? 
                        Math.round((this.state.correctDecisions / this.state.totalDecisions) * 100) : 0;
                    const currentImpact = this.state.userCumulativeEffect;
                    const currentMaxRoundReached = this.state.currentRound;
                    
                    console.log('Personal best comparison:', {
                        personalBest,
                        currentAccuracy,
                        currentImpact,
                        roundsCompleted,
                        currentMaxRoundReached,
                        isNewBest: currentMaxRoundReached > personalBest.bestRound || 
                            (currentMaxRoundReached === personalBest.bestRound && currentAccuracy > personalBest.bestAccuracy) ||
                            currentImpact > personalBest.bestImpact
                    });
                    
                    // Determine if this is a first-time player (no previous personal best)
                    const isFirstTimePlayer = personalBest.bestRound === 0 && personalBest.bestAccuracy === 0 && personalBest.bestImpact === 0;
                    
                    if (isFirstTimePlayer) {
                        // Show general message for first-time players
                        const generalMessageElement = document.getElementById('general-message');
                        if (generalMessageElement) {
                            generalMessageElement.textContent = "Keep playing to improve and climb the leaderboards!";
                            generalMessageElement.style.display = 'block';
                        }
                    } else {
                        // Show detailed messages for returning players
                        this.updateBlockMessages(personalBest, currentMaxRoundReached, currentAccuracy, currentImpact);
                    }

                    // Now save the session data
                    if (typeof Backend !== 'undefined') {
                        await Backend.logEvent({
                            eventType: 'session_end',
                            roundNumber: this.state.currentRound,
                            payload: {
                                total_attempts: this.state.totalAttempts,
                                accuracy_pct: currentAccuracy,
                                user_impact_cpd: this.state.userCumulativeEffect,
                                competitor_impact_cpd: this.state.competitorCumulativeEffect
                            }
                        });
                        // Final session summary update
                        await Backend.upsertSessionSummary({
                            maxRound: this.state.currentRound,
                            impactCpd: this.state.userCumulativeEffect,
                            accuracyPct: currentAccuracy,
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

                        // Calculate and display ranking improvements
                        this.updateRankingImprovements(userRanks);
                    }
                } catch (err) {
                    console.error('Failed to finalize session with backend', err);
                }
            })();
        });
    },

    startNewSession() {
        const completionModal = document.getElementById('completion-modal');
        const gameMenu = document.getElementById('game-menu');

        // Hide completion modal
        completionModal.classList.add('hidden');
        completionModal.classList.remove('fade-in');

        // Show game menu (home page)
        gameMenu.classList.remove('hidden');

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
        // Keep the selected competitor for the new session
        // this.state.selectedCompetitor = null;
        this.state.roundResults = []; // Reset round results
        this.updateExperimentDots(); // Update experiment dots for new session

        // Update displays only if elements exist (they might not be visible during game over)
        const accuracyElement = document.getElementById('accuracy');
        if (accuracyElement) {
            this.updateAccuracyDisplay(0);
        }
        
        const roundElement = document.getElementById('current-round');
        if (roundElement) {
            this.updateRoundDisplay();
        }
        
        const impactElements = document.getElementById('user-impact');
        if (impactElements) {
            this.updateImpactDisplay();
        }

        // Reset button text
        const nextButton = document.getElementById('next-challenge-btn');
        if (nextButton) {
            nextButton.textContent = 'Next!';
        }

        // Reset progress bar
        const progressBar = document.getElementById('progress-bar');
        if (progressBar) {
            progressBar.style.width = '0%';
        }

        // Clear any existing experiment data
        window.currentExperiment = null;
        window.currentAnalysis = null;

        // Start a new session automatically with the same player name and opponent
        const playerName = window.playerName || 'Player';
        const selectedCompetitor = this.state.selectedCompetitor || window.selectedOpponent || 'HiPPO';
        
        console.log('Starting new session with:', { playerName, selectedCompetitor });
        
        // Start the backend session and load the first challenge
        (async () => {
            try {
                if (typeof Backend !== 'undefined') {
                    await Backend.startSession({
                        displayName: playerName,
                        meta: { ts: Date.now(), competitor: selectedCompetitor }
                    });
                    await Backend.logEvent({
                        eventType: 'session_start',
                        roundNumber: 1,
                        payload: { competitor: selectedCompetitor }
                    });
                }
            } catch (err) {
                console.error('Failed to start backend session', err);
            }

            // Set the selected competitor in the state
            this.state.selectedCompetitor = selectedCompetitor;
            
            // Start the session and show round splash
            await this.startSession();
            this.showRoundSplash();
        })();
    },

    updateBlockMessages(personalBest, currentMaxRoundReached, currentAccuracy, currentImpact) {
        // Update rounds block message
        const roundsMessageElement = document.getElementById('rounds-block-message');
        if (roundsMessageElement) {
            let roundsMessage = '';
            if (currentMaxRoundReached > personalBest.bestRound) {
                roundsMessage = `New personal best! Previous: ${personalBest.bestRound} rounds, ${personalBest.bestAccuracy}% accuracy.`;
            } else if (currentMaxRoundReached === personalBest.bestRound && currentAccuracy > personalBest.bestAccuracy) {
                roundsMessage = `New personal best! Previous: ${personalBest.bestRound} rounds, ${personalBest.bestAccuracy}% accuracy.`;
            } else {
                roundsMessage = `Personal best: ${personalBest.bestRound} rounds, ${personalBest.bestAccuracy}% accuracy.`;
            }
            roundsMessageElement.textContent = roundsMessage;
            roundsMessageElement.style.display = 'block';
        }

        // Update impact block message
        const impactMessageElement = document.getElementById('impact-block-message');
        if (impactMessageElement) {
            let impactMessage = '';
            if (currentImpact > personalBest.bestImpact) {
                impactMessage = `New personal best! Previous: ${personalBest.bestImpact} cpd.`;
            } else {
                impactMessage = `Personal best: ${personalBest.bestImpact} cpd.`;
            }
            impactMessageElement.textContent = impactMessage;
            impactMessageElement.style.display = 'block';
        }
    },

    updateRankingImprovements(finalRanks) {
        console.log('Updating ranking improvements:', {
            startingRoundsRank: this.state.sessionStartRoundsRank,
            finalRoundsRank: finalRanks.roundsRank,
            startingImpactRank: this.state.sessionStartImpactRank,
            finalImpactRank: finalRanks.impactRank
        });

        // Only show rank changes for players who had rankings before this session started
        // Check if they had any previous sessions (not just if they have current rankings)
        const isFirstTimePlayer = this.state.sessionStartPersonalBest.bestRound === 0 && 
                                  this.state.sessionStartPersonalBest.bestAccuracy === 0 && 
                                  this.state.sessionStartPersonalBest.bestImpact === 0;
        
        if (isFirstTimePlayer) {
            // Hide all rank improvement indicators for first-time players
            const roundsImprovementElement = document.getElementById('rounds-rank-improvement');
            const impactImprovementElement = document.getElementById('impact-rank-improvement');
            
            if (roundsImprovementElement) {
                roundsImprovementElement.style.display = 'none';
            }
            if (impactImprovementElement) {
                impactImprovementElement.style.display = 'none';
            }
            return;
        }

        // Update rounds rank improvement
        if (this.state.sessionStartRoundsRank && finalRanks.roundsRank) {
            const roundsImprovement = this.state.sessionStartRoundsRank - finalRanks.roundsRank;
            const roundsImprovementElement = document.getElementById('rounds-rank-improvement');
            
            if (roundsImprovement > 0) {
                roundsImprovementElement.textContent = `↑${roundsImprovement}`;
                roundsImprovementElement.style.color = '#10b981'; // green
                roundsImprovementElement.style.display = 'block';
            } else if (roundsImprovement < 0) {
                roundsImprovementElement.textContent = `↓${Math.abs(roundsImprovement)}`;
                roundsImprovementElement.style.color = '#ef4444'; // red
                roundsImprovementElement.style.display = 'block';
            } else {
                roundsImprovementElement.style.display = 'none';
            }
        }

        // Update impact rank improvement
        if (this.state.sessionStartImpactRank && finalRanks.impactRank) {
            const impactImprovement = this.state.sessionStartImpactRank - finalRanks.impactRank;
            const impactImprovementElement = document.getElementById('impact-rank-improvement');
            
            if (impactImprovement > 0) {
                impactImprovementElement.textContent = `↑${impactImprovement}`;
                impactImprovementElement.style.color = '#10b981'; // green
                impactImprovementElement.style.display = 'block';
            } else if (impactImprovement < 0) {
                impactImprovementElement.textContent = `↓${Math.abs(impactImprovement)}`;
                impactImprovementElement.style.color = '#ef4444'; // red
                impactImprovementElement.style.display = 'block';
            } else {
                impactImprovementElement.style.display = 'none';
            }
        }
    },

    shareOnTwitter() {
        const accuracy = this.state.totalDecisions > 0 ? 
            Math.round((this.state.correctDecisions / this.state.totalDecisions) * 100) : 0;
        const text = `I just completed the A/B Testing Gym challenge with ${accuracy}% accuracy! Try it yourself!`;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`);
    },

    shareOnLinkedIn() {
        const accuracy = this.state.totalDecisions > 0 ? 
            Math.round((this.state.correctDecisions / this.state.totalDecisions) * 100) : 0;
        const text = `I just completed the A/B Testing Gym challenge with ${accuracy}% accuracy! Try it yourself!`;
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}&summary=${encodeURIComponent(text)}`);
    },

    updateImpactDisplay() {
        const userImpactElement = document.getElementById('user-impact');
        const opponentImpactElement = document.getElementById('opponent-impact');
        
        if (userImpactElement) {
            userImpactElement.textContent = `${this.state.userCumulativeEffect} cpd`;
        }
        if (opponentImpactElement) {
            opponentImpactElement.textContent = `${this.state.competitorCumulativeEffect} cpd`;
        }
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