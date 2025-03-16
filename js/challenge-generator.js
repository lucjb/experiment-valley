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

    // Adjust to match total (might need multiple passes due to rounding)
    let currentTotal = patternedVisitors.reduce((sum, v) => sum + v, 0);
    let diff = totalVisitors - currentTotal;

    // Distribute the difference across days proportionally to their current values
    while (Math.abs(diff) > 0) {
        const adjustmentPerVisitor = diff / currentTotal;
        for (let i = 0; i < numDays && Math.abs(diff) > 0; i++) {
            const adjustment = Math.min(
                Math.abs(diff),
                Math.max(1, Math.round(patternedVisitors[i] * Math.abs(adjustmentPerVisitor)))
            ) * Math.sign(diff);

            patternedVisitors[i] += adjustment;
            diff -= adjustment;
        }
        currentTotal = patternedVisitors.reduce((sum, v) => sum + v, 0);
    }

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

    // Adjust totals like in weekly pattern
    let currentTotal = patternedVisitors.reduce((sum, v) => sum + v, 0);
    let diff = totalVisitors - currentTotal;

    while (Math.abs(diff) > 0) {
        const adjustmentPerVisitor = diff / currentTotal;
        for (let i = 0; i < numWeeks && Math.abs(diff) > 0; i++) {
            const adjustment = Math.min(
                Math.abs(diff),
                Math.max(1, Math.round(patternedVisitors[i] * Math.abs(adjustmentPerVisitor)))
            ) * Math.sign(diff);

            patternedVisitors[i] += adjustment;
            diff -= adjustment;
        }
        currentTotal = patternedVisitors.reduce((sum, v) => sum + v, 0);
    }

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

    // Adjust totals like in other patterns
    let currentTotal = patternedVisitors.reduce((sum, v) => sum + v, 0);
    let diff = totalVisitors - currentTotal;

    while (Math.abs(diff) > 0) {
        const adjustmentPerVisitor = diff / currentTotal;
        for (let i = 0; i < numMonths && Math.abs(diff) > 0; i++) {
            const adjustment = Math.min(
                Math.abs(diff),
                Math.max(1, Math.round(patternedVisitors[i] * Math.abs(adjustmentPerVisitor)))
            ) * Math.sign(diff);

            patternedVisitors[i] += adjustment;
            diff -= adjustment;
        }
        currentTotal = patternedVisitors.reduce((sum, v) => sum + v, 0);
    }

    return patternedVisitors;
}

function distributeConversions(totalConversions, dailyVisitors) {
    const numDays = dailyVisitors.length;
    const avgConversionRate = totalConversions / dailyVisitors.reduce((sum, v) => sum + v, 0);

    // First, distribute conversions independently with noise
    const dailyConversions = new Array(numDays).fill(0).map((_, i) => {
        // Allow conversion rate to vary by ±20% from average
        const dayRate = avgConversionRate * (1 + (Math.random() * 0.4 - 0.2));
        // Calculate conversions based on this day's rate
        return Math.round(dailyVisitors[i] * dayRate);
    });

    // Calculate the current total
    let currentTotal = dailyConversions.reduce((sum, v) => sum + v, 0);

    // First pass: If we have too many conversions, reduce them proportionally
    if (currentTotal > totalConversions) {
        const reduction = totalConversions / currentTotal;
        for (let i = 0; i < numDays; i++) {
            dailyConversions[i] = Math.round(dailyConversions[i] * reduction);
        }
        currentTotal = dailyConversions.reduce((sum, v) => sum + v, 0);
    }

    // Second pass: Add any remaining conversions to days that have room
    let remaining = totalConversions - currentTotal;
    if (remaining > 0) {
        // Create array of days with available capacity
        const daysWithRoom = Array.from({length: numDays}, (_, i) => ({
            index: i,
            room: dailyVisitors[i] - dailyConversions[i]
        })).filter(d => d.room > 0);

        // Distribute remaining conversions randomly among days with capacity
        while (remaining > 0 && daysWithRoom.length > 0) {
            const dayIndex = Math.floor(Math.random() * daysWithRoom.length);
            const day = daysWithRoom[dayIndex];

            const add = Math.min(remaining, day.room);
            dailyConversions[day.index] += add;
            remaining -= add;

            // Update or remove the day if it's full
            day.room -= add;
            if (day.room <= 0) {
                daysWithRoom.splice(dayIndex, 1);
            }
        }
    }

    // Final validation: ensure no day has more conversions than visitors
    for (let i = 0; i < numDays; i++) {
        if (dailyConversions[i] > dailyVisitors[i]) {
            console.warn(`Day ${i} had more conversions than visitors, capping at visitor count`);
            dailyConversions[i] = dailyVisitors[i];
        }
    }

    return dailyConversions;
}

function determineTimePeriod(numDays) {
    if (numDays <= 28) {
        return { period: 'day', numPeriods: numDays };
    } else if (numDays <= 196) { // 28 weeks
        return { period: 'week', numPeriods: Math.ceil(numDays / 7) };
    } else {
        return { period: 'month', numPeriods: Math.ceil(numDays / 28) };
    }
}

function generateTimelineData(baseVisitors, variantVisitors, baseConversions, variantConversions, numDays, alpha) {
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
    const baseConversionsPerPeriod = distributeConversions(baseConversions, baseVisitorsPerPeriod);
    const variantConversionsPerPeriod = distributeConversions(variantConversions, variantVisitorsPerPeriod);

    // Calculate cumulative metrics
    let cumulativeBaseVisitors = 0;
    let cumulativeBaseConversions = 0;
    let cumulativeVariantVisitors = 0;
    let cumulativeVariantConversions = 0;

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
                }
            };
        }),
        timePeriod: period,
        periodsCount: numPeriods,
        totalDays: numDays
    };
}

function generateABTestChallenge() {
    // Predefined options for each parameter
    const ALPHA_OPTIONS = [0.1];
    const BETA_OPTIONS = [0.2];
    const BASE_CONVERSION_RATE_OPTIONS = [0.0127, 0.0523, 0.0814, 0.102, 0.146];
    const MRE_OPTIONS = [0.01, 0.02];
    const VISITORS_PER_DAY_OPTIONS = [150, 1200];
    const BUSINESS_CYCLE_DAYS_OPTIONS = [1, 7];

    // Randomly select one option from each array
    const ALPHA = ALPHA_OPTIONS[Math.floor(Math.random() * ALPHA_OPTIONS.length)];
    const BETA = BETA_OPTIONS[Math.floor(Math.random() * BETA_OPTIONS.length)];
    const BASE_CONVERSION_RATE = BASE_CONVERSION_RATE_OPTIONS[Math.floor(Math.random() * BASE_CONVERSION_RATE_OPTIONS.length)];
    const MRE = MRE_OPTIONS[Math.floor(Math.random() * MRE_OPTIONS.length)];
    const VISITORS_PER_DAY = VISITORS_PER_DAY_OPTIONS[Math.floor(Math.random() * VISITORS_PER_DAY_OPTIONS.length)];
    const BUSINESS_CYCLE_DAYS = BUSINESS_CYCLE_DAYS_OPTIONS[Math.floor(Math.random() * BUSINESS_CYCLE_DAYS_OPTIONS.length)];

    // Calculate required sample size
    var varianceA = BASE_CONVERSION_RATE * (1 - BASE_CONVERSION_RATE);
    var varianceB = (BASE_CONVERSION_RATE + MRE) * (1 - (BASE_CONVERSION_RATE + MRE));
    var requiredSampleSizePerVariant = solveSampleSizeTTest(MRE, 1 - BETA, varianceA, varianceB, ALPHA);
    var requiredRuntimeDays = Math.ceil((requiredSampleSizePerVariant * 2) / VISITORS_PER_DAY);

    // Ensure runtime is at least 7 days and aligned with business cycles
    requiredRuntimeDays = Math.max(7, requiredRuntimeDays);
    requiredRuntimeDays = Math.ceil(requiredRuntimeDays / BUSINESS_CYCLE_DAYS) * BUSINESS_CYCLE_DAYS;

    const actualBaseConversionRate = sampleBetaDistribution(
        100000 * BASE_CONVERSION_RATE,
        100000 * (1 - BASE_CONVERSION_RATE)
    );

    // Calculate effect size as a relative change instead of absolute
    const relativeEffectSize = sampleNormalDistribution(MRE / BASE_CONVERSION_RATE, MRE / (10 * BASE_CONVERSION_RATE));

    // Apply effect size as a relative change, ensuring we don't go below 20% of base rate
    const variantConversionRate = actualBaseConversionRate * (1 + (Math.random() < 0.5 ? relativeEffectSize : -Math.min(0.8, Math.abs(relativeEffectSize))));

    // Ensure variant rate is never zero or too close to zero
    const minimumRate = actualBaseConversionRate * 0.2; // minimum 20% of base rate
    const adjustedVariantRate = Math.max(minimumRate, variantConversionRate);

    const actualVisitorsTotal = requiredRuntimeDays * VISITORS_PER_DAY + sampleBinomial(VISITORS_PER_DAY, 0.8);
    const actualVisitorsBase = sampleBinomial(actualVisitorsTotal, 0.5);
    const actualVisitorsVariant = actualVisitorsTotal - actualVisitorsBase;

    const actualConversionsBase = sampleBinomial(actualVisitorsBase, actualBaseConversionRate);
    const actualConversionsVariant = sampleBinomial(actualVisitorsVariant, adjustedVariantRate);

    const { pValue } = computeTTest(actualConversionsBase, actualVisitorsBase, actualConversionsVariant, actualVisitorsVariant);

    const ciBase = computeConfidenceInterval(actualConversionsBase / actualVisitorsBase, actualVisitorsBase, ALPHA);
    const ciVariant = computeConfidenceInterval(actualConversionsVariant / actualVisitorsVariant, actualVisitorsVariant, ALPHA);

    // Calculate difference CI directly using pooled standard error
    const observedDifference = (actualConversionsVariant / actualVisitorsVariant) - (actualConversionsBase / actualVisitorsBase);
    const pooledSE = Math.sqrt(
        ((actualConversionsBase / actualVisitorsBase) * (1 - actualConversionsBase / actualVisitorsBase)) / actualVisitorsBase +
        ((actualConversionsVariant / actualVisitorsVariant) * (1 - actualConversionsVariant / actualVisitorsVariant)) / actualVisitorsVariant
    );
    const zScoreCI = jStat.normal.inv(1 - ALPHA / 2, 0, 1);
    const diffMarginOfError = zScoreCI * pooledSE;
    const ciDifference = [
        observedDifference - diffMarginOfError,
        observedDifference + diffMarginOfError
    ];

    // Generate timeline data
    const timelineData = generateTimelineData(
        actualVisitorsBase,
        actualVisitorsVariant,
        actualConversionsBase,
        actualConversionsVariant,
        requiredRuntimeDays,
        ALPHA
    );


    // Calculate uplift as relative percentage change
    const actualBaseRate = actualConversionsBase / actualVisitorsBase;
    const actualVariantRate = actualConversionsVariant / actualVisitorsVariant;
    const conversionRateUplift = (actualVariantRate / actualBaseRate) - 1;

    // Calculate visitor and conversion uplifts
    const visitorUplift = (actualVisitorsVariant / actualVisitorsBase) - 1;
    const conversionUplift = (actualConversionsVariant / actualConversionsBase) - 1;

    const upliftCI = computeUpliftConfidenceInterval(
        actualBaseRate,
        actualVariantRate,
        actualVisitorsBase,
        actualVisitorsVariant,
        ALPHA
    );

    return {
        experiment: {
            alpha: ALPHA,
            beta: BETA,
            baseConversionRate: BASE_CONVERSION_RATE,
            minimumRelevantEffect: MRE,
            visitorsPerDay: VISITORS_PER_DAY,
            businessCycleDays: BUSINESS_CYCLE_DAYS,
            requiredSampleSizePerVariant: requiredSampleSizePerVariant,
            requiredRuntimeDays: requiredRuntimeDays
        },
        simulation: {
            actualBaseConversionRate: actualBaseRate,
            actualEffectSize: relativeEffectSize,
            variantConversionRate: actualVariantRate,
            actualVisitorsBase: actualVisitorsBase,
            actualVisitorsVariant: actualVisitorsVariant,
            actualConversionsBase: actualConversionsBase,
            actualConversionsVariant: actualConversionsVariant,
            pValue: pValue,
            confidenceIntervalBase: ciBase,
            confidenceIntervalVariant: ciVariant,
            confidenceIntervalDifference: ciDifference,
            timeline: timelineData,
            uplift: conversionRateUplift,
            upliftConfidenceInterval: upliftCI,
            visitorUplift: visitorUplift,
            conversionUplift: conversionUplift
        }
    };
}

window.generateABTestChallenge = generateABTestChallenge;