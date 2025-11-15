// Virtual Competitors
function normalizeDecisionForStatus(decision, experiment) {
    const status = experiment.status || { state: EXPERIMENT_STATUS.RUNNING, deployedVariant: null };
    if (status.state !== EXPERIMENT_STATUS.STOPPED) {
        return decision;
    }

    const deployedVariant = status.deployedVariant || DEPLOYED_VARIANT.BASE;
    if (decision === EXPERIMENT_DECISION.KEEP_RUNNING) {
        return EXPERIMENT_DECISION.RESTART_EXPERIMENT;
    }
    if (decision === EXPERIMENT_DECISION.KEEP_BASE) {
        return deployedVariant === DEPLOYED_VARIANT.BASE
            ? EXPERIMENT_DECISION.KEEP_DEPLOYED_VARIANT
            : EXPERIMENT_DECISION.RESTART_EXPERIMENT;
    }
    if (decision === EXPERIMENT_DECISION.KEEP_VARIANT) {
        return deployedVariant === DEPLOYED_VARIANT.VARIANT
            ? EXPERIMENT_DECISION.KEEP_DEPLOYED_VARIANT
            : EXPERIMENT_DECISION.RESTART_EXPERIMENT;
    }
    return decision;
}

const VirtualCompetitors = {
    // HiPPO (Highest Paid Person's Opinion) - Makes decisions based on personal opinion, ignoring data
    HiPPO: {
        name: "HiPPO",
        description: "Makes decisions based on personal opinion, ignoring statistical significance and data quality",
        makeDecision: (experiment) => {
            const { simulation: { pValue, confidenceIntervalDifference } } = experiment;
            
            // HiPPO ignores p-values and confidence intervals
            // They make decisions based on their gut feeling about the change
            // They have a strong bias towards change (90% chance of choosing variant)
            // But they do consider the improvement direction in their gut feeling
            const random = Math.random();
            let decision;
            
            // HiPPO's gut feeling is influenced by improvement direction
            // For LOWER_IS_BETTER: they're more likely to choose variant if it appears lower
            // For HIGHER_IS_BETTER: they're more likely to choose variant if it appears higher
            const timeline = experiment.simulation.timeline;
            const latestPoint = timeline.timePoints[timeline.timePoints.length - 1];
            const directionFactor = experiment.experiment.improvementDirection === IMPROVEMENT_DIRECTION.LOWER ? -1 : 1;
            const cumulativeDiff = latestPoint ? latestPoint.difference.cumulativeRate * directionFactor : 0;
            
            // HiPPO's bias is stronger when the direction aligns with their gut feeling
            const biasStrength = Math.abs(cumulativeDiff) > 0.01 ? 0.95 : 0.9; // Stronger bias when there's a clear difference
            const directionBias = cumulativeDiff > 0 ? biasStrength : (1 - biasStrength);
            
            decision = random < directionBias ? EXPERIMENT_DECISION.KEEP_VARIANT : EXPERIMENT_DECISION.KEEP_BASE;
            const followUp = decision === EXPERIMENT_DECISION.KEEP_VARIANT ? EXPERIMENT_FOLLOW_UP.CELEBRATE : EXPERIMENT_FOLLOW_UP.ITERATE;
            
            const normalizedDecision = normalizeDecisionForStatus(decision, experiment);
            return {
                trust: EXPERIMENT_TRUSTWORTHY.YES, // HiPPO doesn't care about data quality
                decision: normalizedDecision,
                followUp: followUp
            };
        }
    },

    // Random - Makes random decisions
    Random: {
        name: "Random",
        description: "Makes decisions randomly, without analyzing the data",
        makeDecision: (experiment) => {
            // Random opponent is truly random, but we can make it slightly biased
            // towards the improvement direction to make it more realistic
            const timeline = experiment.simulation.timeline;
            const latestPoint = timeline.timePoints[timeline.timePoints.length - 1];
            const directionFactor = experiment.experiment.improvementDirection === IMPROVEMENT_DIRECTION.LOWER ? -1 : 1;
            const cumulativeDiff = latestPoint ? latestPoint.difference.cumulativeRate * directionFactor : 0;
            
            // Random decisions with slight bias towards improvement direction
            const decisions = [EXPERIMENT_DECISION.KEEP_BASE, EXPERIMENT_DECISION.KEEP_VARIANT, EXPERIMENT_DECISION.KEEP_RUNNING];
            const followUps = [EXPERIMENT_FOLLOW_UP.CELEBRATE, EXPERIMENT_FOLLOW_UP.ITERATE, EXPERIMENT_FOLLOW_UP.VALIDATE, EXPERIMENT_FOLLOW_UP.RERUN, EXPERIMENT_FOLLOW_UP.DO_NOTHING];
            const trusts = [EXPERIMENT_TRUSTWORTHY.YES, EXPERIMENT_TRUSTWORTHY.NO];
            
            // Slight bias: if the direction suggests variant is better, slightly favor variant
            let decision;
            const random = Math.random();
            if (cumulativeDiff > 0.005) {
                // Slight bias towards variant when it appears better
                decision = random < 0.6 ? EXPERIMENT_DECISION.KEEP_VARIANT : 
                         random < 0.8 ? EXPERIMENT_DECISION.KEEP_BASE : EXPERIMENT_DECISION.KEEP_RUNNING;
            } else if (cumulativeDiff < -0.005) {
                // Slight bias towards base when variant appears worse
                decision = random < 0.6 ? EXPERIMENT_DECISION.KEEP_BASE : 
                         random < 0.8 ? EXPERIMENT_DECISION.KEEP_VARIANT : EXPERIMENT_DECISION.KEEP_RUNNING;
            } else {
                // Truly random when unclear
                decision = decisions[Math.floor(Math.random() * decisions.length)];
            }
            
            const normalizedDecision = normalizeDecisionForStatus(decision, experiment);
            return {
                trust: trusts[Math.floor(Math.random() * trusts.length)],
                decision: normalizedDecision,
                followUp: followUps[Math.floor(Math.random() * followUps.length)]
            };
        }
    },

    // Naive - Makes decisions based on early results (14 days)
    Naive: {
        name: "Naive",
        description: "Chooses the variant with the highest conversion rate at day 14, ignoring confidence intervals and p-values",
        makeDecision: (experiment) => {
            const timeline = experiment.simulation.timeline;
            const daysElapsed = timeline.currentRuntimeDays;
            
            // Find the time point that includes day 14
            const day14Point = timeline.timePoints.find(point => 
                point.period.startDay <= 14 && point.period.endDay >= 14
            );
            const directionFactor = experiment.experiment.improvementDirection === IMPROVEMENT_DIRECTION.LOWER ? -1 : 1;
            const cumulativeDiff = day14Point ? day14Point.difference.cumulativeRate * directionFactor : 0;
            
            if (daysElapsed >= 14) {
                if (cumulativeDiff > 0) {
                    return {
                        trust: EXPERIMENT_TRUSTWORTHY.YES,
                        decision: normalizeDecisionForStatus(EXPERIMENT_DECISION.KEEP_VARIANT, experiment),
                        followUp: EXPERIMENT_FOLLOW_UP.CELEBRATE
                    };
                } else {
                    return {
                        trust: EXPERIMENT_TRUSTWORTHY.YES,
                        decision: normalizeDecisionForStatus(EXPERIMENT_DECISION.KEEP_BASE, experiment),
                        followUp: EXPERIMENT_FOLLOW_UP.ITERATE
                    };
                }
            } else {
                return {
                    trust: EXPERIMENT_TRUSTWORTHY.YES,
                    decision: normalizeDecisionForStatus(EXPERIMENT_DECISION.KEEP_RUNNING, experiment),
                    followUp: EXPERIMENT_FOLLOW_UP.DO_NOTHING
                };
            }
        }
    },

    // Peeker - Checks for significance daily after first week, which can lead to false positives
    "Peek-a-boo": {
        name: "Peek-a-boo",
        description: "Peek-a-boo! Still not significant… maybe tomorrow!",
        makeDecision: (experiment) => {
            const { 
                simulation: { 
                    timeline: { currentRuntimeDays, timePoints }
                }
            } = experiment;

            // Wait at least one week
            if (currentRuntimeDays < 7) {
                return {
                    trust: EXPERIMENT_TRUSTWORTHY.YES,
                    decision: normalizeDecisionForStatus(EXPERIMENT_DECISION.KEEP_RUNNING, experiment),
                    followUp: EXPERIMENT_FOLLOW_UP.DO_NOTHING
                };
            }

            // After a week, check confidence intervals
            // For LOWER_IS_BETTER: check if upper bound is negative (variant is definitely lower)
            // For HIGHER_IS_BETTER: check if lower bound is positive (variant is definitely higher)
            const directionFactor = experiment.experiment.improvementDirection === IMPROVEMENT_DIRECTION.LOWER ? -1 : 1;
            const hasSignificantEffect = timePoints.some(point => {
                if (point.period.startDay <= 6) return false;
                
                const [lowerBound, upperBound] = point.difference.cumulativeRateCI;
                
                if (experiment.experiment.improvementDirection === IMPROVEMENT_DIRECTION.LOWER) {
                    // For lower is better: check if upper bound is negative (variant is definitely lower)
                    return upperBound < 0;
                } else {
                    // For higher is better: check if lower bound is positive (variant is definitely higher)
                    return lowerBound > 0;
                }
            });

            if (hasSignificantEffect) {
                return {
                    trust: EXPERIMENT_TRUSTWORTHY.YES,
                    decision: normalizeDecisionForStatus(EXPERIMENT_DECISION.KEEP_VARIANT, experiment),
                    followUp: EXPERIMENT_FOLLOW_UP.CELEBRATE
                };
            } else {
                return {
                    trust: EXPERIMENT_TRUSTWORTHY.YES,
                    decision: normalizeDecisionForStatus(EXPERIMENT_DECISION.KEEP_BASE, experiment),
                    followUp: EXPERIMENT_FOLLOW_UP.ITERATE
                };
            }
        }
    }
};