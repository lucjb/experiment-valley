if (typeof jStat === 'undefined') {
    console.error("jStat is not loaded. Please include jStat in your HTML file.");
}

function sampleBetaDistribution(alpha, beta) {
    return jStat.beta.sample(alpha, beta);
}

function sampleNormalDistribution(mean, variance) {
    return jStat.normal.sample(mean, Math.sqrt(variance));
}

function sampleBinomial(n, p) {
    if (p <= 0) return 0;
    if (p >= 1) return n;

    let successes = 0;
    for (let i = 0; i < n; i++) {
        if (Math.random() < p) {
            successes++;
        }
    }
    return successes;
}

function computeTTest(conversionsA, visitorsA, conversionsB, visitorsB) {
    if (visitorsA === 0 || visitorsB === 0) {
        return { tStatistic: NaN, pValue: NaN };
    }

    const epsilon = 1e-10;
    const pA = Math.max(epsilon, Math.min(1 - epsilon, conversionsA / visitorsA));
    const pB = Math.max(epsilon, Math.min(1 - epsilon, conversionsB / visitorsB));

    const varA = (pA * (1 - pA)) / visitorsA;
    const varB = (pB * (1 - pB)) / visitorsB;
    const se = Math.sqrt(varA + varB);

    if (se === 0) {
        return { tStatistic: NaN, pValue: NaN };
    }

    const tStatistic = (pB - pA) / se;
    const degreesOfFreedom = Math.max(1, visitorsA + visitorsB - 2);
    const pValue = 2 * (1 - jStat.studentt.cdf(Math.abs(tStatistic), degreesOfFreedom));

    return { tStatistic, pValue };
}

function computeConfidenceInterval(conversionRate, visitors, alpha) {
    if (visitors === 0) return [0, 0];
    const se = Math.sqrt((conversionRate * (1 - conversionRate)) / visitors);
    const zScore = jStat.normal.inv(1 - alpha / 2, 0, 1);
    const marginOfError = zScore * se;

    return [
        Math.max(0, conversionRate - marginOfError),
        Math.min(1, conversionRate + marginOfError)
    ];
}

function computePriorEstimateConfidenceInterval(baseConversionRate, businessCycleDays, visitorsPerDay, dataQualityAlpha) {
    // Calculate confidence interval for the prior estimate using specified alpha level
    const priorSampleSize = 4 * businessCycleDays * visitorsPerDay;
    const priorStandardError = Math.sqrt((baseConversionRate * (1 - baseConversionRate)) / priorSampleSize);
    const zScore = jStat.normal.inv(1 - dataQualityAlpha / 2, 0, 1);
    const marginOfError = zScore * priorStandardError;
    const ciLow = Math.max(0, baseConversionRate - marginOfError);
    const ciHigh = Math.min(1, baseConversionRate + marginOfError);

    return {
        sampleSize: priorSampleSize,
        confidenceInterval: [ciLow, ciHigh],
        standardError: priorStandardError
    };
}

function solveSampleSizeTTest(effectSize, power, varianceA, varianceB, alpha) {
    var zAlpha = jStat.normal.inv(1 - alpha / 2, 0, 1);
    var zBeta = jStat.normal.inv(power, 0, 1);
    return Math.ceil(
        ((zAlpha + zBeta) * (zAlpha + zBeta) * (varianceA + varianceB)) / (effectSize * effectSize)
    );
}

function computeUpliftConfidenceInterval(baseRate, variantRate, baseVisitors, variantVisitors, alpha = 0.05) {
    // Calculate standard errors
    const seBase = Math.sqrt((baseRate * (1 - baseRate)) / baseVisitors);
    const seVariant = Math.sqrt((variantRate * (1 - variantRate)) / variantVisitors);

    // Calculate coefficients of variation
    const cvBase = seBase / baseRate;
    const cvVariant = seVariant / variantRate;

    // Calculate squared terms
    const cvBaseSquared = cvBase * cvBase;
    const cvVariantSquared = cvVariant * cvVariant;

    // Get z-score for the given alpha
    const zScore = jStat.normal.inv(1 - alpha / 2, 0, 1);
    const zSquared = zScore * zScore;

    const pctDiff = (variantRate / baseRate) - 1;

    // Calculate the confidence interval using the formula from the image
    const numerator = (1 - zScore * Math.sqrt(cvBaseSquared + cvVariantSquared - zSquared * cvBaseSquared * cvVariantSquared));
    const denominator = 1 - zSquared * cvBaseSquared;
    const lb = (pctDiff + 1) * (numerator / denominator) - 1;

    const numeratora = (1 + zScore * Math.sqrt(cvBaseSquared + cvVariantSquared - zSquared * cvBaseSquared * cvVariantSquared));
    const ub = (pctDiff + 1) * (numeratora / denominator) - 1;

    return [
        lb,
        ub
    ];
}

function distributeDailyVisitors(totalVisitors, numDays) {
    // First, distribute visitors evenly
    const baseVisitorsPerDay = Math.floor(totalVisitors / numDays);
    const dailyVisitors = new Array(numDays).fill(baseVisitorsPerDay);

    // Add remainder to first day
    const remainder = totalVisitors - (baseVisitorsPerDay * numDays);
    dailyVisitors[0] += remainder;

    return dailyVisitors;
}

function distributeDiff(patternedVisitors, diff) {
    if (diff !== 0) {
        const numUnits = patternedVisitors.length;
        const increment = Math.ceil(diff / numUnits);
        for (let i = 0; i < numUnits - 1; i++) {
            patternedVisitors[i] += increment;
            diff -= increment;
        }
        // Add remaining diff to a random unit
        const randomUnit = Math.floor(Math.random() * numUnits);
        patternedVisitors[randomUnit] += diff;
    }
    // Function modifies array in place, no return needed
}

function addWeeklyPattern(dailyVisitors) {
    const numDays = dailyVisitors.length;
    const totalVisitors = dailyVisitors.reduce((sum, v) => sum + v, 0);

    // Weekly pattern base weights
    const weeklyPattern = [
        1.2,  // Monday: Higher than average
        1.1,  // Tuesday: Slightly higher
        1.0,  // Wednesday: Average
        1.1,  // Thursday: Slightly higher
        1.2,  // Friday: Higher than average
        0.7,  // Saturday: Lower
        0.7   // Sunday: Lower
    ];

    // Calculate average daily visitors without pattern
    const avgDailyVisitors = totalVisitors / numDays;

    // Apply pattern with noise
    const patternedVisitors = dailyVisitors.map((_, i) => {
        const dayOfWeek = i % 7;
        const baseWeight = weeklyPattern[dayOfWeek];
        // Add random noise between -10% to +10% of the base weight
        const noise = (Math.random() * 0.2) - 0.1; // Random value between -0.1 and 0.1
        const weight = baseWeight * (1 + noise);
        return Math.round(avgDailyVisitors * weight);
    });

    // Calculate current total after pattern application
    let currentTotal = patternedVisitors.reduce((sum, v) => sum + v, 0);
    let diff = totalVisitors - currentTotal;

    // Use shared distributeDiff function
    distributeDiff(patternedVisitors, diff);

    return patternedVisitors;
}

function addMonthlyPattern(weeklyVisitors) {
    const numWeeks = weeklyVisitors.length;
    const totalVisitors = weeklyVisitors.reduce((sum, v) => sum + v, 0);

    // Monthly pattern (4 weeks per month)
    const monthlyPattern = [
        1.1,  // Week 1: Start of month, higher activity
        1.0,  // Week 2: Normal activity
        0.9,  // Week 3: Slightly lower
        1.0   // Week 4: Back to normal
    ];

    // Calculate average weekly visitors
    const avgWeeklyVisitors = totalVisitors / numWeeks;

    // Apply pattern with noise
    const patternedVisitors = weeklyVisitors.map((_, i) => {
        const weekOfMonth = i % 4;
        const baseWeight = monthlyPattern[weekOfMonth];
        // Add random noise between -15% to +15%
        const noise = (Math.random() * 0.3) - 0.15;
        const weight = baseWeight * (1 + noise);
        return Math.round(avgWeeklyVisitors * weight);
    });

    // Calculate current total after pattern application
    let currentTotal = patternedVisitors.reduce((sum, v) => sum + v, 0);
    let diff = totalVisitors - currentTotal;

    // Use shared distributeDiff function
    distributeDiff(patternedVisitors, diff);

    return patternedVisitors;
}

function addYearlyPattern(monthlyVisitors) {
    const numMonths = monthlyVisitors.length;
    const totalVisitors = monthlyVisitors.reduce((sum, v) => sum + v, 0);

    // Yearly pattern (seasonal trends)
    const yearlyPattern = [
        0.9,   // January: Post-holiday drop
        0.85,  // February: Winter lull
        1.0,   // March: Spring pickup
        1.1,   // April: Strong spring
        1.2,   // May: Peak spring
        1.1,   // June: Early summer
        1.0,   // July: Mid-summer
        1.0,   // August: Late summer
        1.1,   // September: Back to school/work
        1.2,   // October: Fall peak
        1.15,  // November: Pre-holiday
        1.3    // December: Holiday peak
    ];

    // Calculate average monthly visitors
    const avgMonthlyVisitors = totalVisitors / numMonths;

    // Apply pattern with noise
    const patternedVisitors = monthlyVisitors.map((_, i) => {
        const monthOfYear = i % 12;
        const baseWeight = yearlyPattern[monthOfYear];
        // Add random noise between -20% to +20%
        const noise = (Math.random() * 0.4) - 0.2;
        const weight = baseWeight * (1 + noise);
        return Math.round(avgMonthlyVisitors * weight);
    });

    // Calculate current total after pattern application
    let currentTotal = patternedVisitors.reduce((sum, v) => sum + v, 0);
    let diff = totalVisitors - currentTotal;

    // Use shared distributeDiff function
    distributeDiff(patternedVisitors, diff);

    return patternedVisitors;
}

function addNoiseToConversions(conversions, visitors) {
    const numPeriods = conversions.length;
    // Number of swaps to perform - about 20% of the periods
    const numSwaps = Math.max(1, Math.floor(numPeriods * 0.5));

    for (let swap = 0; swap < numSwaps; swap++) {
        // Pick first random period
        let period1 = Math.floor(Math.random() * numPeriods);
        // Pick second period
        let period2 = Math.floor(Math.random() * numPeriods);

        // If periods are the same, just skip this swap
        if (period1 === period2) continue;

        // Swap the values
        // Calculate how many conversions we can move
        const maxFromPeriod1 = Math.max(0, conversions[period1] - 1); // Keep at least 1 conversion
        const maxToPeriod2 = visitors[period2] - conversions[period2]; // Can't exceed visitors

        if (maxFromPeriod1 > 0 && maxToPeriod2 > 0) {
            // Move a random amount up to the maximum possible
            const amount = Math.min(
                maxFromPeriod1,
                maxToPeriod2,
                Math.max(Math.ceil(maxFromPeriod1 / 2), Math.floor(Math.random() * maxFromPeriod1))
            );

            conversions[period1] -= amount;
            conversions[period2] += amount;
        }
    }
    return conversions;
}

function distributeConversions(totalConversions, dailyVisitors) {
    const numDays = dailyVisitors.length;
    const totalVisitors = dailyVisitors.reduce((sum, v) => sum + v, 0);

    // Ensure we don't try to convert more visitors than we have
    const maxPossibleConversions = Math.min(totalConversions, totalVisitors);

    // Calculate uniform conversion rate
    const uniformRate = maxPossibleConversions / totalVisitors;

    // First pass: distribute conversions uniformly
    const dailyConversions = new Array(numDays);
    let distributedConversions = 0;

    for (let i = 0; i < numDays; i++) {
        // Calculate expected conversions for this day
        const expectedConversions = Math.round(dailyVisitors[i] * uniformRate);
        // Ensure we don't exceed visitors or remaining conversions
        dailyConversions[i] = Math.min(
            dailyVisitors[i],
            expectedConversions,
            maxPossibleConversions - distributedConversions
        );
        distributedConversions += dailyConversions[i];
    }

    // Second pass: distribute any remaining conversions
    let remaining = maxPossibleConversions - distributedConversions;
    if (remaining > 0) {
        // Find days that can accept more conversions
        const daysWithCapacity = Array.from({ length: numDays }, (_, i) => i)
            .filter(i => dailyConversions[i] < dailyVisitors[i]);

        // Distribute remaining one at a time
        while (remaining > 0 && daysWithCapacity.length > 0) {
            // Rotate through days with capacity
            const dayIndex = daysWithCapacity.shift();

            if (dailyConversions[dayIndex] < dailyVisitors[dayIndex]) {
                dailyConversions[dayIndex]++;
                remaining--;

                // If day still has capacity, add it back to the end
                if (dailyConversions[dayIndex] < dailyVisitors[dayIndex]) {
                    daysWithCapacity.push(dayIndex);
                }
            }
        }
    }

    // Add noise by swapping conversions between days
    addNoiseToConversions(dailyConversions, dailyVisitors);

    return dailyConversions;
}

function determineTimePeriod(numDays) {
    if (numDays <= 56) {
        return { period: 'day', numPeriods: numDays };
    } else if (numDays <= 196) { // 28 weeks
        return { period: 'week', numPeriods: Math.ceil(numDays / 7) };
    } else {
        return { period: 'month', numPeriods: Math.ceil(numDays / 28) };
    }
}

function computeDifferenceConfidenceInterval(baseRate, variantRate, baseVisitors, variantVisitors, alpha) {
    if (baseVisitors === 0 || variantVisitors === 0) {
        return [0, 0];
    }

    const epsilon = 1e-10;
    const pA = Math.max(epsilon, Math.min(1 - epsilon, baseRate));
    const pB = Math.max(epsilon, Math.min(1 - epsilon, variantRate));

    const varA = (pA * (1 - pA)) / baseVisitors;
    const varB = (pB * (1 - pB)) / variantVisitors;
    const pooledSE = Math.sqrt(varA + varB);

    if (pooledSE === 0) {
        return [0, 0];
    }

    const observedDifference = pB - pA;
    const zScore = jStat.normal.inv(1 - alpha / 2, 0, 1);
    const marginOfError = zScore * pooledSE;

    return [
        observedDifference - marginOfError,
        observedDifference + marginOfError
    ];
}

function addDataLoss(visitors, conversions) {
    const lossDay = Math.floor(Math.random() * visitors.length);
    const lostVisitors = visitors[lossDay];
    const lostConversions = conversions[lossDay];

    const remainingDays = visitors.length - 1;
    const visitorsPerDay = Math.floor(lostVisitors / remainingDays);
    const conversionsPerDay = Math.floor(lostConversions / remainingDays);
    const visitorsRemainder = lostVisitors % remainingDays;
    const conversionsRemainder = lostConversions % remainingDays;

    return {
        visitors: visitors.map((value, index) => {
            if (index === lossDay) return 0;
            return value + visitorsPerDay + (visitorsRemainder > 0 ? 1 : 0);
        }),
        conversions: conversions.map((value, index) => {
            if (index === lossDay) return 0;
            return value + conversionsPerDay + (conversionsRemainder > 0 ? 1 : 0);
        })
    };
}

function generateTimelineData(baseVisitors, variantVisitors, baseConversions, variantConversions, numDays, alpha, currentRuntimeDays, businessCycleDays, dataLoss) {
    // Determine appropriate time period
    const { period, numPeriods } = determineTimePeriod(numDays);
    const daysPerPeriod = period === 'day' ? 1 : period === 'week' ? 7 : 28;

    // First distribute visitors evenly
    let baseVisitorsPerPeriod = distributeDailyVisitors(baseVisitors, numPeriods);
    let variantVisitorsPerPeriod = distributeDailyVisitors(variantVisitors, numPeriods);

    // Add appropriate pattern based on the period
    if (period === 'day') {
        baseVisitorsPerPeriod = addWeeklyPattern(baseVisitorsPerPeriod);
        variantVisitorsPerPeriod = addWeeklyPattern(variantVisitorsPerPeriod);
    } else if (period === 'week') {
        baseVisitorsPerPeriod = addMonthlyPattern(baseVisitorsPerPeriod);
        variantVisitorsPerPeriod = addMonthlyPattern(variantVisitorsPerPeriod);
    } else { // month
        baseVisitorsPerPeriod = addYearlyPattern(baseVisitorsPerPeriod);
        variantVisitorsPerPeriod = addYearlyPattern(variantVisitorsPerPeriod);
    }

    // Distribute conversions
    var baseConversionsPerPeriod = distributeConversions(baseConversions, baseVisitorsPerPeriod);
    var variantConversionsPerPeriod = distributeConversions(variantConversions, variantVisitorsPerPeriod);

    if (dataLoss) {
        const { visitors: newVisitors, conversions: newConversions } = addDataLoss(variantVisitorsPerPeriod, variantConversionsPerPeriod);
        variantVisitorsPerPeriod = newVisitors;
        variantConversionsPerPeriod = newConversions;
    }

    // Calculate cumulative metrics
    let cumulativeBaseVisitors = 0;
    let cumulativeBaseConversions = 0;
    let cumulativeVariantVisitors = 0;
    let cumulativeVariantConversions = 0;


    let lastFullWeekIndex = 0;
    if (period === 'day') {
        lastFullWeekIndex = currentRuntimeDays - currentRuntimeDays % 7 - 1;
    } else {
        lastFullWeekIndex = currentRuntimeDays % 7 ? numPeriods - 2 : numPeriods - 1;
    }

    return {
        timePoints: Array.from({ length: numPeriods }, (_, i) => {
            // Update cumulative counters
            cumulativeBaseVisitors += baseVisitorsPerPeriod[i];
            cumulativeBaseConversions += baseConversionsPerPeriod[i];
            cumulativeVariantVisitors += variantVisitorsPerPeriod[i];
            cumulativeVariantConversions += variantConversionsPerPeriod[i];

            // Calculate rates and CIs
            const baseRate = baseVisitorsPerPeriod[i] === 0 ? 0 : baseConversionsPerPeriod[i] / baseVisitorsPerPeriod[i];
            const variantRate = variantVisitorsPerPeriod[i] === 0 ? 0 : variantConversionsPerPeriod[i] / variantVisitorsPerPeriod[i];
            const baseCumulativeRate = cumulativeBaseVisitors === 0 ? 0 : cumulativeBaseConversions / cumulativeBaseVisitors;
            const variantCumulativeRate = cumulativeVariantVisitors === 0 ? 0 : cumulativeVariantConversions / cumulativeVariantVisitors;

            // Calculate difference and its CI for both daily and cumulative rates
            const dailyDiffCI = computeDifferenceConfidenceInterval(
                baseRate,
                variantRate,
                baseVisitorsPerPeriod[i],
                variantVisitorsPerPeriod[i],
                alpha
            );

            const cumulativeDiffCI = computeDifferenceConfidenceInterval(
                baseCumulativeRate,
                variantCumulativeRate,
                cumulativeBaseVisitors,
                cumulativeVariantVisitors,
                alpha
            );

            // Calculate uplift and its CI for both daily and cumulative rates
            const dailyUplift = baseRate === 0 ? 0 : (variantRate / baseRate) - 1;
            const cumulativeUplift = baseCumulativeRate === 0 ? 0 : (variantCumulativeRate / baseCumulativeRate) - 1;

            const dailyUpliftCI = computeUpliftConfidenceInterval(
                baseRate,
                variantRate,
                baseVisitorsPerPeriod[i],
                variantVisitorsPerPeriod[i],
                alpha
            );

            const cumulativeUpliftCI = computeUpliftConfidenceInterval(
                baseCumulativeRate,
                variantCumulativeRate,
                cumulativeBaseVisitors,
                cumulativeVariantVisitors,
                alpha
            );

            return {
                period: {
                    type: period,
                    index: i,
                    startDay: i * daysPerPeriod + 1,
                    endDay: Math.min((i + 1) * daysPerPeriod, numDays)
                },
                base: {
                    visitors: baseVisitorsPerPeriod[i],
                    conversions: baseConversionsPerPeriod[i],
                    rate: baseRate,
                    rateCI: computeConfidenceInterval(baseRate, baseVisitorsPerPeriod[i], alpha),
                    cumulativeVisitors: cumulativeBaseVisitors,
                    cumulativeConversions: cumulativeBaseConversions,
                    cumulativeRate: baseCumulativeRate,
                    cumulativeRateCI: computeConfidenceInterval(baseCumulativeRate, cumulativeBaseVisitors, alpha)
                },
                variant: {
                    visitors: variantVisitorsPerPeriod[i],
                    conversions: variantConversionsPerPeriod[i],
                    rate: variantRate,
                    rateCI: computeConfidenceInterval(variantRate, variantVisitorsPerPeriod[i], alpha),
                    cumulativeVisitors: cumulativeVariantVisitors,
                    cumulativeConversions: cumulativeVariantConversions,
                    cumulativeRate: variantCumulativeRate,
                    cumulativeRateCI: computeConfidenceInterval(variantCumulativeRate, cumulativeVariantVisitors, alpha)
                },
                difference: {
                    rate: variantRate - baseRate,
                    rateCI: dailyDiffCI,
                    cumulativeRate: variantCumulativeRate - baseCumulativeRate,
                    cumulativeRateCI: cumulativeDiffCI
                },
                uplift: {
                    rate: dailyUplift,
                    rateCI: dailyUpliftCI,
                    cumulativeRate: cumulativeUplift,
                    cumulativeRateCI: cumulativeUpliftCI
                }
            };
        }),
        timePeriod: period,
        periodsCount: numPeriods,
        totalDays: numDays,
        lastFullBusinessCycleIndex: lastFullWeekIndex
    };
}

class ChallengeDesign {
    constructor({
        timeProgress = TIME_PROGRESS.FULL,
        baseRateMismatch = BASE_RATE_MISMATCH.NO,
        effectSize = EFFECT_SIZE.NONE,
        sampleRatioMismatch = SAMPLE_RATIO_MISMATCH.NO,
        sampleProgress = SAMPLE_PROGRESS.TIME,
        visitorsLoss = VISITORS_LOSS.NO,
        improvementDirection = IMPROVEMENT_DIRECTION.HIGHER,
        twymanFabrication = false,
        overdue = false
    } = {}) {
        this.timeProgress = timeProgress;
        this.baseRateMismatch = baseRateMismatch;
        this.effectSize = effectSize;
        this.sampleRatioMismatch = sampleRatioMismatch;
        this.sampleProgress = sampleProgress;
        this.visitorsLoss = visitorsLoss;
        this.improvementDirection = improvementDirection;
        this.twymanFabrication = twymanFabrication;
        this.overdue = overdue;
    }

    generate() {
        return generateABTestChallenge(
            this.timeProgress,
            this.baseRateMismatch,
            this.effectSize,
            this.sampleRatioMismatch,
            this.sampleProgress,
            this.visitorsLoss,
            this.improvementDirection,
            this.twymanFabrication,
            this.overdue
        );
    }

    withBaseRateMismatch() {
        this.baseRateMismatch = BASE_RATE_MISMATCH.YES;
        return this;
    }

    withSampleRatioMismatch() {
        this.sampleRatioMismatch = SAMPLE_RATIO_MISMATCH.SMALL;
        return this;
    }

    withVisitorsLoss() {
        this.visitorsLoss = VISITORS_LOSS.YES;
        return this;
    }

    withLowerIsBetter() {
        this.improvementDirection = IMPROVEMENT_DIRECTION.LOWER;
        return this;
    }
    withLarrgePositiveEffect() {
        this.effectSize = EFFECT_SIZE.LARGE_IMPROVEMENT;
        return this;
    }
    withLargeNegativeEffect() {
        this.effectSize = EFFECT_SIZE.LARGE_DEGRADATION;
        return this;
    }
    withSmallPositiveEffect() {
        this.effectSize = EFFECT_SIZE.SMALL_IMPROVEMENT;
        return this;
    }
    withSmallNegativeEffect() {
        this.effectSize = EFFECT_SIZE.SMALL_DEGRADATION;
        return this;
    }
    withNoEffect() {
        this.effectSize = EFFECT_SIZE.NONE;
        return this;
    }

    withPostiveEffect() {
        this.effectSize = EFFECT_SIZE.IMPROVEMENT;
        return this;
    }
    withNegativeEffect() {
        this.effectSize = EFFECT_SIZE.DEGRADATION;
        return this;
    }

    withOverdue() {
        this.overdue = true;
        return this;
    }

}

function winner() {
    return new ChallengeDesign({
        timeProgress: TIME_PROGRESS.FULL,
        effectSize: EFFECT_SIZE.IMPROVEMENT,
        sampleProgress: SAMPLE_PROGRESS.TIME
    });
}

function inconclusive() {
    return new ChallengeDesign({
        timeProgress: TIME_PROGRESS.FULL,
        baseRateMismatch: BASE_RATE_MISMATCH.NO,
        effectSize: EFFECT_SIZE.NONE,
        sampleRatioMismatch: SAMPLE_RATIO_MISMATCH.NO,
        sampleProgress: SAMPLE_PROGRESS.TIME
    });
}

function loser() {
    return new ChallengeDesign({
        timeProgress: TIME_PROGRESS.FULL,
        baseRateMismatch: BASE_RATE_MISMATCH.NO,
        effectSize: EFFECT_SIZE.SMALL_DEGRADATION,
        sampleRatioMismatch: SAMPLE_RATIO_MISMATCH.NO,
        sampleProgress: SAMPLE_PROGRESS.TIME
    });
}

function bigLoser() {
    return new ChallengeDesign({
        timeProgress: TIME_PROGRESS.FULL,
        baseRateMismatch: BASE_RATE_MISMATCH.NO,
        effectSize: EFFECT_SIZE.DEGRADATION,
        sampleRatioMismatch: SAMPLE_RATIO_MISMATCH.NO,
        sampleProgress: SAMPLE_PROGRESS.TIME
    });
}

function largeWinner() {
    return new ChallengeDesign({
        timeProgress: TIME_PROGRESS.FULL,
        baseRateMismatch: BASE_RATE_MISMATCH.NO,
        effectSize: EFFECT_SIZE.LARGE_IMPROVEMENT,
        sampleRatioMismatch: SAMPLE_RATIO_MISMATCH.NO,
        sampleProgress: SAMPLE_PROGRESS.TIME
    });
}

function partialWinner() {
    return new ChallengeDesign({
        timeProgress: TIME_PROGRESS.PARTIAL,
        baseRateMismatch: BASE_RATE_MISMATCH.NO,
        effectSize: EFFECT_SIZE.SMALL_IMPROVEMENT,
        sampleRatioMismatch: SAMPLE_RATIO_MISMATCH.NO,
        sampleProgress: SAMPLE_PROGRESS.TIME
    });
}

function partialLoser() {
    return new ChallengeDesign({
        timeProgress: TIME_PROGRESS.PARTIAL,
        baseRateMismatch: BASE_RATE_MISMATCH.NO,
        effectSize: EFFECT_SIZE.SMALL_DEGRADATION,
        sampleRatioMismatch: SAMPLE_RATIO_MISMATCH.NO,
        sampleProgress: SAMPLE_PROGRESS.TIME
    });
}

function fastWinner() {
    return new ChallengeDesign({
        timeProgress: TIME_PROGRESS.PARTIAL_WEEKS,
        baseRateMismatch: BASE_RATE_MISMATCH.NO,
        effectSize: EFFECT_SIZE.IMPROVEMENT,
        sampleRatioMismatch: SAMPLE_RATIO_MISMATCH.NO,
        sampleProgress: SAMPLE_PROGRESS.FULL
    });
}

// achieves required sample size faster than expected, but always in full weeks
function fast() {
    return new ChallengeDesign({
        timeProgress: TIME_PROGRESS.PARTIAL_WEEKS,
        sampleProgress: SAMPLE_PROGRESS.FULL
    });
}

function slowCompletion() {
    return new ChallengeDesign({
        timeProgress: TIME_PROGRESS.FULL,
        baseRateMismatch: BASE_RATE_MISMATCH.NO,
        effectSize: EFFECT_SIZE.DEGRADATION,
        sampleRatioMismatch: SAMPLE_RATIO_MISMATCH.NO,
        sampleProgress: SAMPLE_PROGRESS.PARTIAL
    });
}

function fastLoserWithPartialWeek() {
    return new ChallengeDesign({
        timeProgress: TIME_PROGRESS.PARTIAL,
        baseRateMismatch: BASE_RATE_MISMATCH.NO,
        effectSize: EFFECT_SIZE.SMALL_DEGRADATION,
        sampleRatioMismatch: SAMPLE_RATIO_MISMATCH.NO,
        sampleProgress: SAMPLE_PROGRESS.FULL
    });
}

function twymansLawTrap() {
    return new ChallengeDesign({
        timeProgress: TIME_PROGRESS.FULL,
        baseRateMismatch: BASE_RATE_MISMATCH.NO,
        effectSize: EFFECT_SIZE.NONE,
        sampleRatioMismatch: SAMPLE_RATIO_MISMATCH.NO,
        sampleProgress: SAMPLE_PROGRESS.FULL,
        twymanFabrication: true
    });
}



const TIME_PROGRESS = { FULL: "FULL", PARTIAL: "PARTIAL", EARLY: "EARLY", PARTIAL_WEEKS: "PARTIAL_WEEKS" };
const SAMPLE_PROGRESS = { FULL: "FULL", PARTIAL: "PARTIAL", TIME: "TIME" };
const BASE_RATE_MISMATCH = { NO: 1, YES: 0.1 };
const EFFECT_SIZE = { NONE: 0, SMALL_IMPROVEMENT: 0.05, IMPROVEMENT: 0.85, LARGE_IMPROVEMENT: 2, DEGRADATION: -0.8, SMALL_DEGRADATION: -0.05, LARGE_DEGRADATION: -2 };
const SAMPLE_RATIO_MISMATCH = { NO: 0.5, LARGE: 0.4, SMALL: 0.47 };
const VISITORS_LOSS = { NO: false, YES: true };
const IMPROVEMENT_DIRECTION = { HIGHER: 'HIGHER_IS_BETTER', LOWER: 'LOWER_IS_BETTER' };

function generateABTestChallenge(
    timeProgress = TIME_PROGRESS.FULL,
    baseRateMismatch = BASE_RATE_MISMATCH.NO,
    effectSize = EFFECT_SIZE.NONE,
    sampleRatioMismatch = SAMPLE_RATIO_MISMATCH.NO,
    sampleProgress = SAMPLE_PROGRESS.TIME,
    visitorsLoss = VISITORS_LOSS.NO,
    improvementDirection = IMPROVEMENT_DIRECTION.HIGHER,
    twymanFabrication = false,
    overdue = false) {

    // Predefined options for each parameter ,
    const ALPHA_OPTIONS = [0.1, 0.05, 0.01];
    const BETA_OPTIONS = [0.2];
    const SAMPLE_SIZE_INPUT_OPTIONS = [[0.1241, 9650, 0.005]]//, [0.34, 380, 0.1]]//, [0.05, 500, 0.01], [0.0127, 8300, 0.001]]
    const BUSINESS_CYCLE_DAYS_OPTIONS = [7];

    // Randomly select one option from each array
    const ALPHA = ALPHA_OPTIONS[Math.floor(Math.random() * ALPHA_OPTIONS.length)];
    const BETA = BETA_OPTIONS[Math.floor(Math.random() * BETA_OPTIONS.length)];

    const SAMPLE_SIZE_INPUT = SAMPLE_SIZE_INPUT_OPTIONS[Math.floor(Math.random() * SAMPLE_SIZE_INPUT_OPTIONS.length)];
    const BASE_CONVERSION_RATE = SAMPLE_SIZE_INPUT[0];
    const VISITORS_PER_DAY = SAMPLE_SIZE_INPUT[1];
    const MRE = SAMPLE_SIZE_INPUT[2];
    const BUSINESS_CYCLE_DAYS = BUSINESS_CYCLE_DAYS_OPTIONS[Math.floor(Math.random() * BUSINESS_CYCLE_DAYS_OPTIONS.length)];

    // Calculate required sample size
    var varianceA = BASE_CONVERSION_RATE * (1 - BASE_CONVERSION_RATE);
    var varianceB = (BASE_CONVERSION_RATE + MRE) * (1 - (BASE_CONVERSION_RATE + MRE));
    var requiredSampleSizePerVariant = solveSampleSizeTTest(MRE, 1 - BETA, varianceA, varianceB, ALPHA);
    var requiredRuntimeDays = Math.ceil((requiredSampleSizePerVariant * 2) / VISITORS_PER_DAY);
    // Ensure runtime is at least 7 days full weeks
    requiredRuntimeDays = Math.max(7, requiredRuntimeDays);
    requiredRuntimeDays = Math.ceil(requiredRuntimeDays / 7) * 7;

    var currentRuntimeDays = requiredRuntimeDays;
    if (timeProgress === TIME_PROGRESS.PARTIAL) {
        currentRuntimeDays = Math.floor(requiredRuntimeDays * (Math.random() * 0.4 + 0.5));
        if (sampleProgress === SAMPLE_PROGRESS.FULL) {
            currentRuntimeDays = requiredRuntimeDays - 2;
        }
    } else if (timeProgress === TIME_PROGRESS.EARLY) {
        currentRuntimeDays = 5;
    } else if (timeProgress === TIME_PROGRESS.PARTIAL_WEEKS) {
        if (requiredRuntimeDays > 7) {
            currentRuntimeDays = requiredRuntimeDays - (requiredRuntimeDays % 7 || 7);
        } else {
            currentRuntimeDays = requiredRuntimeDays;
        }
    }
    
    // Apply overdue if specified (orthogonal to timeProgress)
    if (overdue) {
        // Experiment ran longer than planned - add a random number of extra days (not always full weeks)
        const extraDays = Math.floor(Math.random() * 21) + 1; // 1..21 extra days
        currentRuntimeDays = requiredRuntimeDays + extraDays;
    }

    var actualBaseConversionRate = BASE_CONVERSION_RATE;
    if (!twymanFabrication) {
        actualBaseConversionRate = sampleBetaDistribution(
            1000000 * baseRateMismatch * BASE_CONVERSION_RATE,
            1000000 * (1 - BASE_CONVERSION_RATE * baseRateMismatch)
        );

    }

    // Calculate effect size as a relative change instead of absolute
    const actualRelativeEffectSize = effectSize * MRE / actualBaseConversionRate //sampleNormalDistribution(MRE / BASE_CONVERSION_RATE, MRE / (10 * BASE_CONVERSION_RATE));

    // Apply effect size as a relative change, ensuring we don't go below 20% of base rate
    let actualVariantConversionRate = actualBaseConversionRate * (1 + actualRelativeEffectSize);


    var observedVisitorsTotal = currentRuntimeDays * VISITORS_PER_DAY + sampleBinomial(VISITORS_PER_DAY, 0.1);
    if (sampleProgress === SAMPLE_PROGRESS.FULL && (timeProgress === TIME_PROGRESS.PARTIAL_WEEKS || timeProgress === TIME_PROGRESS.PARTIAL)) {
        observedVisitorsTotal = Math.floor(requiredSampleSizePerVariant * 2.05);
    }
    if (sampleProgress === SAMPLE_PROGRESS.PARTIAL && timeProgress === TIME_PROGRESS.FULL) {
        observedVisitorsTotal = Math.floor(requiredSampleSizePerVariant * 1.95);
    }

    observedVisitorsTotal = Math.ceil(observedVisitorsTotal / (2 * sampleRatioMismatch));

    var observedVisitorsBase = sampleBinomial(observedVisitorsTotal, sampleRatioMismatch);
    var observedVisitorsVariant = observedVisitorsTotal - observedVisitorsBase;

    let observedConversionsBase = Math.ceil(observedVisitorsBase * actualBaseConversionRate);
    let observedConversionsVariant = sampleBinomial(observedVisitorsVariant, actualVariantConversionRate);

    // Twyman's Law fabrication mode: zero true effect, but fabricate a huge observed lift
    if (twymanFabrication) {
        // Ensure true effect is exactly zero
        actualBaseConversionRate = BASE_CONVERSION_RATE;
        actualVariantConversionRate = actualBaseConversionRate;

        // Keep base aligned with prior to avoid base rate mismatch
        observedConversionsBase = Math.round(observedVisitorsBase * actualBaseConversionRate);

        // Fabricate variant conversions to create an extremely large, "too good" effect
        // Choose a variant rate far above base but below 100%, and above base + 10*MRE
        const targetLift = Math.max(0.15, 10 * MRE + 0.05); // at least +15pp or +10*MRE+5pp
        const fabricatedVariantRate = Math.min(0.98, actualBaseConversionRate + targetLift);
        observedConversionsVariant = Math.min(
            observedVisitorsVariant,
            Math.max(observedConversionsBase + 1, Math.round(observedVisitorsVariant * fabricatedVariantRate))
        );
    }

    const { pValue } = computeTTest(observedConversionsBase, observedVisitorsBase, observedConversionsVariant, observedVisitorsVariant);

    const ciBase = computeConfidenceInterval(observedConversionsBase / observedVisitorsBase, observedVisitorsBase, ALPHA);
    const ciVariant = computeConfidenceInterval(observedConversionsVariant / observedVisitorsVariant, observedVisitorsVariant, ALPHA);

    // Calculate difference CI using the computeDifferenceConfidenceInterval function
    const ciDifference = computeDifferenceConfidenceInterval(
        observedConversionsBase / observedVisitorsBase,
        observedConversionsVariant / observedVisitorsVariant,
        observedVisitorsBase,
        observedVisitorsVariant,
        ALPHA
    );

    // Generate timeline data
    const timelineData = generateTimelineData(
        observedVisitorsBase,
        observedVisitorsVariant,
        observedConversionsBase,
        observedConversionsVariant,
        currentRuntimeDays,
        ALPHA,
        currentRuntimeDays,
        BUSINESS_CYCLE_DAYS,
        visitorsLoss
    );

    // Calculate uplift as relative percentage change
    const observedBaseRate = observedConversionsBase / observedVisitorsBase;
    const observedVariantRate = observedConversionsVariant / observedVisitorsVariant;
    const observedConversionRateUplift = (observedVariantRate / observedBaseRate) - 1;

    // Calculate visitor and conversion uplifts
    const visitorUplift = (observedVisitorsVariant / observedVisitorsBase) - 1;
    const conversionUplift = (observedConversionsVariant / observedConversionsBase) - 1;

    const upliftCI = computeUpliftConfidenceInterval(
        observedBaseRate,
        observedVariantRate,
        observedVisitorsBase,
        observedVisitorsVariant,
        ALPHA
    );

    // Calculate prior estimate confidence interval
    const dataQualityAlpha = 0.0001; // 99.99% confidence level for data quality checks
    const priorEstimateCI = computePriorEstimateConfidenceInterval(BASE_CONVERSION_RATE, BUSINESS_CYCLE_DAYS, VISITORS_PER_DAY, dataQualityAlpha);

    return {
        experiment: {
            alpha: ALPHA,
            beta: BETA,
            baseConversionRate: BASE_CONVERSION_RATE,
            minimumRelevantEffect: MRE,
            visitorsPerDay: VISITORS_PER_DAY,
            businessCycleDays: BUSINESS_CYCLE_DAYS,
            requiredSampleSizePerVariant: requiredSampleSizePerVariant,
            requiredRuntimeDays: requiredRuntimeDays,
            improvementDirection: improvementDirection,
            priorEstimateCI: priorEstimateCI,
            dataQualityAlpha: dataQualityAlpha
        },
        simulation: {
            actualBaseConversionRate: actualBaseConversionRate,
            baseConversionRate: observedBaseRate,
            actualEffectSize: actualVariantConversionRate - actualBaseConversionRate,
            variantConversionRate: observedVariantRate,
            actualVisitorsBase: observedVisitorsBase,
            actualVisitorsVariant: observedVisitorsVariant,
            actualConversionsBase: observedConversionsBase,
            actualConversionsVariant: observedConversionsVariant,
            pValue: pValue,
            confidenceIntervalBase: ciBase,
            confidenceIntervalVariant: ciVariant,
            confidenceIntervalDifference: ciDifference,
            timeline: {
                ...timelineData,
                currentRuntimeDays: currentRuntimeDays,
            },
            uplift: observedConversionRateUplift,
            upliftConfidenceInterval: upliftCI,
            visitorUplift: visitorUplift,
            conversionUplift: conversionUplift
        }
    };
}

function checkSampleRatioMismatch(baseVisitors, variantVisitors) {
    // Calculate total visitors and expected ratio
    const totalVisitors = baseVisitors + variantVisitors;
    const expectedRatio = 0.5; // 50-50 split
    const actualRatio = baseVisitors / totalVisitors;

    // Calculate chi-square statistic for statistical significance
    const expectedBase = totalVisitors * expectedRatio;
    const expectedVariant = totalVisitors * expectedRatio;
    const chiSquare = Math.pow(baseVisitors - expectedBase, 2) / expectedBase +
        Math.pow(variantVisitors - expectedVariant, 2) / expectedVariant;

    // Calculate p-value using chi-square distribution
    const pValue = 1 - jStat.chisquare.cdf(chiSquare, 1);

    return {
        actualRatio,
        chiSquare,
        pValue
    };
}

// Constants for analyzeExperiment outputs
const EXPERIMENT_TRUSTWORTHY = {
    YES: 'TRUSTWORTHY',
    NO: 'UNTRUSTWORTHY'
};

const EXPERIMENT_DECISION = {
    KEEP_BASE: "KEEP_BASE",
    KEEP_VARIANT: "KEEP_VARIANT",
    KEEP_RUNNING: "KEEP_RUNNING"
};

const EXPERIMENT_FOLLOW_UP = {
    CELEBRATE: "CELEBRATE",
    ITERATE: "ITERATE",
    VALIDATE: "VALIDATE",
    RERUN: "RERUN",
    DO_NOTHING: "DO_NOTHING",
};

function isExperimentOverdue(experiment) {
    const {
        simulation: {
            timeline: { currentRuntimeDays, timePoints }
        },
        experiment: { requiredRuntimeDays, requiredSampleSizePerVariant }
    } = experiment;

    // Determine if sample size was already reached at a full-week boundary
    let sampleSizeMetAtFullWeek = false;
    if (currentRuntimeDays > 0) {
        // Check each full-week day up to currentRuntimeDays
        for (let day = 7; day <= currentRuntimeDays; day += 7) {
            // Find the last timeline point ending on or before this day
            const point = [...timePoints].reverse().find(tp => tp.period.endDay <= day);
            if (point) {
                const baseCum = point.base.cumulativeVisitors;
                const variantCum = point.variant.cumulativeVisitors;
                if (baseCum >= requiredSampleSizePerVariant && variantCum >= requiredSampleSizePerVariant) {
                    sampleSizeMetAtFullWeek = true;
                    break;
                }
            }
        }
    }

    // Overdue when planned end is in the past AND sample size was met at a full-week boundary
    return currentRuntimeDays > requiredRuntimeDays && sampleSizeMetAtFullWeek;
}

function filterOverdueExperimentData(experiment) {
    const {
        simulation: {
            timeline: { currentRuntimeDays, timePoints }
        },
        experiment: { requiredRuntimeDays, requiredSampleSizePerVariant, alpha }
    } = experiment;

    console.log('🔍 OVERDUE EXPERIMENT DETECTED - Filtering data...');
    // Overdue handling: start at planned end, then add weeks until sample size is met or timeline ends
    let filteredRuntimeDays = Math.ceil(requiredRuntimeDays / 7) * 7; // full-week boundary at/after planned end
    if (filteredRuntimeDays > currentRuntimeDays) filteredRuntimeDays = currentRuntimeDays;
    
    console.log('📅 Starting filtered runtime:', filteredRuntimeDays, 'days');

    const getCumulativesAt = (dayLimit) => {
        const point = [...timePoints].reverse().find(tp => tp.period.endDay <= dayLimit);
        if (!point) {
            return { bV: 0, vV: 0, bC: 0, vC: 0 };
        }
        return {
            bV: point.base.cumulativeVisitors,
            vV: point.variant.cumulativeVisitors,
            bC: point.base.cumulativeConversions,
            vC: point.variant.cumulativeConversions
        };
    };

    let { bV, vV, bC, vC } = getCumulativesAt(filteredRuntimeDays);
    console.log('📊 Initial filtered data:', { bV, vV, bC, vC });
    console.log('📊 Required sample size per variant:', requiredSampleSizePerVariant);
    
    while ((bV < requiredSampleSizePerVariant || vV < requiredSampleSizePerVariant) && filteredRuntimeDays + 7 <= currentRuntimeDays) {
        filteredRuntimeDays += 7;
        ({ bV, vV, bC, vC } = getCumulativesAt(filteredRuntimeDays));
        console.log('📅 Extended to:', filteredRuntimeDays, 'days, data:', { bV, vV, bC, vC });
    }

    // Prepare filtered timeline (only periods up to filteredRuntimeDays)
    const filteredTimePoints = timePoints.filter(tp => tp.period.endDay <= filteredRuntimeDays);

    // Recompute p-value and CI for filtered totals
    const { pValue: filteredP } = computeTTest(bC, bV, vC, vV);
    const filteredDiffCI = computeDifferenceConfidenceInterval(
        bV === 0 ? 0 : bC / bV,
        vV === 0 ? 0 : vC / vV,
        bV,
        vV,
        alpha
    );

    return {
        ...experiment,
        simulation: {
            ...experiment.simulation,
            actualVisitorsBase: bV,
            actualVisitorsVariant: vV,
            actualConversionsBase: bC,
            actualConversionsVariant: vC,
            pValue: filteredP,
            confidenceIntervalDifference: filteredDiffCI,
            timeline: {
                ...experiment.simulation.timeline,
                currentRuntimeDays: filteredRuntimeDays,
                timePoints: filteredTimePoints,
                periodsCount: filteredTimePoints.length,
                totalDays: filteredRuntimeDays
            }
        },
        experiment: {
            ...experiment.experiment,
            requiredRuntimeDays: filteredRuntimeDays // Set to filtered runtime to avoid re-overdue detection
        }
    };
}

function analyzeExperiment(experiment) {
    let {
        simulation: {
            actualVisitorsBase,
            actualVisitorsVariant,
            actualConversionsBase,
            actualConversionsVariant,
            pValue,
            confidenceIntervalDifference,
            timeline: { currentRuntimeDays, timePoints, periodsCount, totalDays }
        },
        experiment: {
            alpha,
            businessCycleDays,
            baseConversionRate,
            visitorsPerDay,
            requiredSampleSizePerVariant,
            requiredRuntimeDays,
            improvementDirection,
            minimumRelevantEffect,
            dataQualityAlpha
        }
    } = experiment;

    let analysisDone = false;
    let trustworthy = EXPERIMENT_TRUSTWORTHY.YES;
    let decision = EXPERIMENT_DECISION.KEEP_RUNNING;
    let followUp = EXPERIMENT_FOLLOW_UP.DO_NOTHING;
    let trustworthyReason = '';
    let decisionReason = '';
    let followUpReason = '';

    // FIRST: Check if experiment is overdue and handle it immediately
    const isOverdue = isExperimentOverdue(experiment);
    console.log('=== OVERDUE ANALYSIS DEBUG ===');
    console.log('Current runtime:', currentRuntimeDays, 'days');
    console.log('Required runtime:', requiredRuntimeDays, 'days');
    console.log('Is overdue:', isOverdue);

    if (isOverdue) {
        const filteredExperiment = filterOverdueExperimentData(experiment);
        console.log('🔄 Recursively analyzing filtered experiment...');
        const filteredAnalysis = analyzeExperiment(filteredExperiment);
        console.log('✅ Filtered analysis complete, returning results...');
        return filteredAnalysis;
    }

    // Calculate runtime status variables
    const fullWeek = currentRuntimeDays >= 7 && currentRuntimeDays % 7 === 0;
    const finished = requiredRuntimeDays === currentRuntimeDays;
    const overdue = currentRuntimeDays > requiredRuntimeDays;

    // Continue with normal analysis using the (possibly filtered) data
    // Run data quality checks on the (possibly filtered) data
    const { pValue: ratioPValue } = checkSampleRatioMismatch(actualVisitorsBase, actualVisitorsVariant);
    const hasSampleRatioMismatch = ratioPValue < 0.0001;

    const actualBaseRate = actualConversionsBase / actualVisitorsBase;
    const priorBaseConversionRate = baseConversionRate;

    // Calculate standard error accounting for noise in the prior estimate
    // The prior estimate is based on a sample size equivalent to 4 business cycles
    const priorEstimateCI = computePriorEstimateConfidenceInterval(priorBaseConversionRate, businessCycleDays, visitorsPerDay, dataQualityAlpha);
    const priorStandardError = priorEstimateCI.standardError;
    const currentStandardError = Math.sqrt((actualBaseRate * (1 - actualBaseRate)) / actualVisitorsBase);
    const combinedStandardError = Math.sqrt(priorStandardError * priorStandardError + currentStandardError * currentStandardError);

    const zScore = Math.abs(actualBaseRate - priorBaseConversionRate) / combinedStandardError;
    // Two-tailed p-value computation using normal distribution for data quality confidence level
    const baseRateTestpValue = 2 * (1 - jStat.normal.cdf(zScore, 0, 1));
    const hasBaseRateMismatch = baseRateTestpValue < dataQualityAlpha && Math.abs(priorBaseConversionRate - actualBaseRate) > priorBaseConversionRate * 0.5;

    const actualDailyTraffic = (actualVisitorsBase + actualVisitorsVariant) / currentRuntimeDays;
    const trafficDifference = (actualDailyTraffic - visitorsPerDay) / visitorsPerDay;
    const hasTrafficMismatch = false;
    const lowSampleSize = actualVisitorsBase < requiredSampleSizePerVariant || actualVisitorsVariant < requiredSampleSizePerVariant;

    // Check for data loss (periods with zero visitors)
    const dataLossIndex = timePoints.findIndex(point =>
        point.base.visitors === 0 || point.variant.visitors === 0
    );
    const hasDataLoss = dataLossIndex !== -1;

    const significant = pValue < alpha;
    const variantRate = actualConversionsVariant / actualVisitorsVariant;
    const baseRate = actualConversionsBase / actualVisitorsBase;
    const directionFactor = improvementDirection === IMPROVEMENT_DIRECTION.LOWER ? -1 : 1;
    const isEffectPositive = directionFactor * (variantRate - baseRate) > 0;

    // Check for Twyman's Law trap: extremely low p-value AND unusually large effect size
    const pValueString = pValue.toFixed(10);
    const suspiciousPValue = pValueString.includes('0.000000') || pValue < 0.000001;
    const absoluteDelta = Math.abs(variantRate - baseRate);
    const largeEffect = absoluteDelta >= 10 * minimumRelevantEffect;
    const hasTwymansLaw = suspiciousPValue && largeEffect;

    const issues = [];
    if (hasSampleRatioMismatch) issues.push('sample ratio mismatch');
    if (hasBaseRateMismatch) issues.push('base rate mismatch');
    if (hasTrafficMismatch) issues.push('traffic mismatch');
    if (hasDataLoss) issues.push('data loss');

    const mismatch = hasSampleRatioMismatch ||
        hasBaseRateMismatch ||
        hasTrafficMismatch ||
        hasDataLoss;

    if (mismatch) {
        trustworthy = EXPERIMENT_TRUSTWORTHY.NO;
        const issueBits = [];
        if (hasSampleRatioMismatch) issueBits.push(`sample ratio mismatch (χ² p=${ratioPValue.toFixed(5)})`);
        if (hasBaseRateMismatch) issueBits.push(`base rate mismatch (z-test p=${baseRateTestpValue.toFixed(5)})`);
        if (hasTrafficMismatch) issueBits.push('traffic mismatch');
        if (hasDataLoss) issueBits.push(`data loss at day ${dataLossIndex + 1}`);
        trustworthyReason = `Data quality issues detected: ${issueBits.join('; ')}. When data quality is compromised, inference is unreliable.`;
        decision = EXPERIMENT_DECISION.KEEP_BASE;
        decisionReason = 'Results are unreliable due to data quality issues; picking a winner could lock in a false signal.';
        followUp = EXPERIMENT_FOLLOW_UP.RERUN;
        followUpReason = 'Resolve data issues (fix allocation, restore tracking, ensure stable traffic), then rerun to collect clean data.';
    } else if (!finished && (lowSampleSize || !fullWeek)) {
        trustworthy = EXPERIMENT_TRUSTWORTHY.NO;
        const remainingDays = Math.max(0, requiredRuntimeDays - currentRuntimeDays);
        const needSample = lowSampleSize ? `sample size is insufficient (have base=${actualVisitorsBase.toLocaleString()}, variant=${actualVisitorsVariant.toLocaleString()}, need ≥ ${requiredSampleSizePerVariant.toLocaleString()} each)` : 'sample size is on track';
        const needCycle = !fullWeek ? 'not a full number of business cycles yet' : 'covers full-week cycles';
        trustworthyReason = `Cannot make trustworthy decisions before achieving full sample size: ${needSample}; ${needCycle}.`;
        decision = EXPERIMENT_DECISION.KEEP_RUNNING;
        decisionReason = `Evidence is still forming (p=${pValue.toFixed(4)} vs α=${alpha}). Let the test run approximately ${remainingDays} more day(s) to reach required power.`;
        followUp = EXPERIMENT_FOLLOW_UP.DO_NOTHING;
        followUpReason = 'Continue collecting data; avoid peeking-driven decisions before reaching required sample and full cycles.';
    } else if (finished && (lowSampleSize || !fullWeek)) {
        trustworthy = EXPERIMENT_TRUSTWORTHY.NO;
        trustworthyReason = `Runtime finished without enough data or full-week coverage (have base=${actualVisitorsBase.toLocaleString()}, variant=${actualVisitorsVariant.toLocaleString()}, need ≥ ${requiredSampleSizePerVariant.toLocaleString()} each; fullWeek=${fullWeek}).`;
        decision = EXPERIMENT_DECISION.KEEP_RUNNING;
        decisionReason = 'Insufficient data at planned stop makes any winner declaration unstable; extend to reach sample and full cycles.';
        followUp = EXPERIMENT_FOLLOW_UP.DO_NOTHING;
        followUpReason = 'Extend the test window or increase traffic until the minimum sample and full cycles are met.';
    } else if (!significant || !isEffectPositive) {
        trustworthy = EXPERIMENT_TRUSTWORTHY.YES;
        trustworthyReason = 'Data quality checks passed.';
        decision = EXPERIMENT_DECISION.KEEP_BASE;
        const [ciLow, ciHigh] = confidenceIntervalDifference;
        const delta = (variantRate - baseRate);
        const directionNote = improvementDirection === IMPROVEMENT_DIRECTION.LOWER ? 'lower is better' : 'higher is better';
        const aligns = isEffectPositive ? 'aligns' : 'does not align';
        decisionReason = `No winning evidence: p=${pValue.toFixed(4)} (α=${alpha}), effect ${aligns} with goal (${directionNote}), Δ=${(delta * 100).toFixed(2)}pp, CI[Δ]=[${(ciLow * 100).toFixed(2)}pp, ${(ciHigh * 100).toFixed(2)}pp].`;
        followUp = EXPERIMENT_FOLLOW_UP.ITERATE;
        followUpReason = 'Explore new hypotheses: larger expected lift, improved UX, or reduced variance; rerun with adequate power.';
    } else {
        // Check for Twyman's Law trap: suspiciously low p-value with positive effect
        if (hasTwymansLaw && isEffectPositive) {
            trustworthy = EXPERIMENT_TRUSTWORTHY.NO;
            trustworthyReason = `Twyman's Law detected: p-value is suspiciously low (p=${pValue.toFixed(10)}). Results that are "too good to be true" often indicate data quality issues, p-hacking, or other problems that make the experiment unreliable.`;
            decision = EXPERIMENT_DECISION.KEEP_VARIANT;
            decisionReason = 'Despite the suspicious p-value, the effect direction aligns with business goals. Proceed with caution and validate thoroughly.';
            followUp = EXPERIMENT_FOLLOW_UP.VALIDATE;
            followUpReason = 'Validate the results through additional testing, data quality checks, and monitoring. The suspiciously low p-value suggests potential issues that need investigation.';
        } else {
            trustworthy = EXPERIMENT_TRUSTWORTHY.YES;
            trustworthyReason = 'Data quality checks passed.';
            decision = EXPERIMENT_DECISION.KEEP_VARIANT;
            const [ciLow, ciHigh] = confidenceIntervalDifference;
            const delta = (variantRate - baseRate);
            if (improvementDirection === IMPROVEMENT_DIRECTION.LOWER) {
                decisionReason = `Variant is significantly lower as desired: p=${pValue.toFixed(4)} (α=${alpha}), Δ=${(delta * 100).toFixed(2)}pp, CI[Δ]=[${(ciLow * 100).toFixed(2)}pp, ${(ciHigh * 100).toFixed(2)}pp].`;
            } else {
                decisionReason = `Variant is significantly better: p=${pValue.toFixed(4)} (α=${alpha}), Δ=${(delta * 100).toFixed(2)}pp, CI[Δ]=[${(ciLow * 100).toFixed(2)}pp, ${(ciHigh * 100).toFixed(2)}pp].`;
            }
            followUp = EXPERIMENT_FOLLOW_UP.CELEBRATE;
            followUpReason = 'Roll out the variant and monitor post-launch performance to confirm lift generalizes.';
        }
    }

    return {
        decision: {
            trustworthy: trustworthy,
            trustworthyReason: trustworthyReason,
            decision: decision,
            decisionReason: decisionReason,
            followUp: followUp,
            followUpReason: followUpReason
        },
        analysis: {
            hasSignificantRatioMismatch: hasSampleRatioMismatch,
            hasBaseRateMismatch: hasBaseRateMismatch,
            hasTrafficMismatch: hasTrafficMismatch,
            hasInsufficientSampleSize: lowSampleSize,
            hasDataLoss: hasDataLoss,
            dataLossIndex: dataLossIndex,
            hasTwymansLaw: hasTwymansLaw,
            ratioMismatch: {
                pValue: ratioPValue
            },
            baseRate: {
                expected: priorBaseConversionRate,
                actual: actualBaseRate,
                difference: actualBaseRate - priorBaseConversionRate,
                pValue: baseRateTestpValue
            },
            traffic: {
                expected: visitorsPerDay,
                actual: actualDailyTraffic,
                difference: trafficDifference
            },
            sampleSize: {
                required: requiredSampleSizePerVariant,
                actualBase: actualVisitorsBase,
                actualVariant: actualVisitorsVariant,
                lowSampleSize: lowSampleSize
            },
            runtime: {
                current: currentRuntimeDays,
                required: requiredRuntimeDays,
                fullWeek: fullWeek,
                finished: finished,
                overdue: overdue
            }
        }
    };
}

window.generateABTestChallenge = generateABTestChallenge;
window.analyzeExperiment = analyzeExperiment;
window.IMPROVEMENT_DIRECTION = IMPROVEMENT_DIRECTION;
