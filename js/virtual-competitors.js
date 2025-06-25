// Virtual Competitors
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
            const random = Math.random();
            const decision = random < 0.9 ? EXPERIMENT_DECISION.KEEP_VARIANT : EXPERIMENT_DECISION.KEEP_BASE;
            const followUp = decision === EXPERIMENT_DECISION.KEEP_VARIANT ? EXPERIMENT_FOLLOW_UP.CELEBRATE : EXPERIMENT_FOLLOW_UP.ITERATE;
            
            return {
                trust: EXPERIMENT_TRUSTWORTHY.YES, // HiPPO doesn't care about data quality
                decision: decision,
                followUp: followUp
            };
        }
    },

    // Random - Makes random decisions
    Random: {
        name: "Random",
        description: "Makes decisions randomly, without analyzing the data",
        makeDecision: (experiment) => {
            const decisions = [EXPERIMENT_DECISION.KEEP_BASE, EXPERIMENT_DECISION.KEEP_VARIANT, EXPERIMENT_DECISION.KEEP_RUNNING];
            const followUps = [EXPERIMENT_FOLLOW_UP.CELEBRATE, EXPERIMENT_FOLLOW_UP.ITERATE, EXPERIMENT_FOLLOW_UP.VALIDATE, EXPERIMENT_FOLLOW_UP.RERUN, EXPERIMENT_FOLLOW_UP.DO_NOTHING];
            const trusts = [EXPERIMENT_TRUSTWORTHY.YES, EXPERIMENT_TRUSTWORTHY.NO];
            
            return {
                trust: trusts[Math.floor(Math.random() * trusts.length)],
                decision: decisions[Math.floor(Math.random() * decisions.length)],
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
                        decision: EXPERIMENT_DECISION.KEEP_VARIANT,
                        followUp: EXPERIMENT_FOLLOW_UP.CELEBRATE
                    };
                } else {
                    return {
                        trust: EXPERIMENT_TRUSTWORTHY.YES,
                        decision: EXPERIMENT_DECISION.KEEP_BASE,
                        followUp: EXPERIMENT_FOLLOW_UP.ITERATE
                    };
                }
            } else {
                return {
                    trust: EXPERIMENT_TRUSTWORTHY.YES,
                    decision: EXPERIMENT_DECISION.KEEP_RUNNING,
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
                    decision: EXPERIMENT_DECISION.KEEP_RUNNING,
                    followUp: EXPERIMENT_FOLLOW_UP.DO_NOTHING
                };
            }

            // After a week, check confidence intervals
            // Look for at least one time point after day 6 where the lower bound of the cumulative difference CI is positive
            const directionFactor = experiment.experiment.improvementDirection === IMPROVEMENT_DIRECTION.LOWER ? -1 : 1;
            const hasPositiveLowerBound = timePoints.some(point =>
                point.period.startDay > 6 && (point.difference.cumulativeRateCI[0] * directionFactor) > 0
            );

            if (hasPositiveLowerBound) {
                return {
                    trust: EXPERIMENT_TRUSTWORTHY.YES,
                    decision: EXPERIMENT_DECISION.KEEP_VARIANT,
                    followUp: EXPERIMENT_FOLLOW_UP.CELEBRATE
                };
            } else {
                return {
                    trust: EXPERIMENT_TRUSTWORTHY.YES,
                    decision: EXPERIMENT_DECISION.KEEP_BASE,
                    followUp: EXPERIMENT_FOLLOW_UP.ITERATE
                };
            }
        }
    }
}; 