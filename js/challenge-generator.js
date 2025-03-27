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
    const numSwaps = Math.max(1, Math.floor(numPeriods * 0.2));

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
                Math.max(1, Math.floor(Math.random() * Math.floor(maxFromPeriod1 / 2)))
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

    // Final validation
    const finalTotal = dailyConversions.reduce((sum, v) => sum + v, 0);
    console.assert(finalTotal === maxPossibleConversions,
        `Total conversions mismatch: ${finalTotal} vs ${maxPossibleConversions}`);

    for (let i = 0; i < numDays; i++) {
        console.assert(dailyConversions[i] <= dailyVisitors[i],
            `Day ${i} has more conversions than visitors`);
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

function generateTimelineData(baseVisitors, variantVisitors, baseConversions, variantConversions, numDays, alpha, currentRuntimeDays, businessCycleDays) {
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
        lastFullBusinessCycleIndex: Math.floor((Math.floor(currentRuntimeDays / 7)*7)/daysPerPeriod) - 1
    };
}

function generateABTestChallenge() {
    // Predefined options for each parameter
    const ALPHA_OPTIONS = [0.1, 0.05, 0.01];
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

    var currentRuntimeDays = requiredRuntimeDays;
    if (Math.random() < 0.5) {
        currentRuntimeDays = Math.floor(requiredRuntimeDays * (Math.random()*0.4+0.5));
    }
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

    const actualVisitorsTotal = currentRuntimeDays * VISITORS_PER_DAY + sampleBinomial(VISITORS_PER_DAY, 0.8);
    const actualVisitorsBase = sampleBinomial(actualVisitorsTotal, 0.5);
    const actualVisitorsVariant = actualVisitorsTotal - actualVisitorsBase;

    const actualConversionsBase = sampleBinomial(actualVisitorsBase, actualBaseConversionRate);
    const actualConversionsVariant = sampleBinomial(actualVisitorsVariant, adjustedVariantRate);

    const { pValue } = computeTTest(actualConversionsBase, actualVisitorsBase, actualConversionsVariant, actualVisitorsVariant);

    const ciBase = computeConfidenceInterval(actualConversionsBase / actualVisitorsBase, actualVisitorsBase, ALPHA);
    const ciVariant = computeConfidenceInterval(actualConversionsVariant / actualVisitorsVariant, actualVisitorsVariant, ALPHA);

    // Calculate difference CI using the computeDifferenceConfidenceInterval function
    const ciDifference = computeDifferenceConfidenceInterval(
        actualConversionsBase / actualVisitorsBase,
        actualConversionsVariant / actualVisitorsVariant,
        actualVisitorsBase,
        actualVisitorsVariant,
        ALPHA
    );

    // Generate timeline data
    const timelineData = generateTimelineData(
        actualVisitorsBase,
        actualVisitorsVariant,
        actualConversionsBase,
        actualConversionsVariant,
        currentRuntimeDays,
        ALPHA,
        currentRuntimeDays,
        BUSINESS_CYCLE_DAYS
    );

    // Calculate the base conversion rate for full business cycles
    const lastFullBusinessCycleIndex = Math.max(0, Math.floor((Math.floor(currentRuntimeDays / BUSINESS_CYCLE_DAYS) * BUSINESS_CYCLE_DAYS) / (timelineData.timePeriod === 'day' ? 7 : timelineData.timePeriod === 'week' ? 7 : 28)) - 1);
    const fullBusinessCyclesBaseConversionRate = timelineData.timePoints[Math.min(lastFullBusinessCycleIndex, timelineData.periodsCount - 1)].base.cumulativeRate;

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
            timeline: {
                ...timelineData,
                currentRuntimeDays: currentRuntimeDays,
                fullBusinessCyclesBaseConversionRate: fullBusinessCyclesBaseConversionRate
            },
            uplift: conversionRateUplift,
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

function analyzeExperiment(experiment) {
    const {
        simulation: {
            actualVisitorsBase,
            actualVisitorsVariant,
            actualConversionsBase,
            actualConversionsVariant,
            pValue,
            confidenceIntervalDifference,
            timeline: { currentRuntimeDays }
        },
        experiment: {
            alpha,
            businessCycleDays,
            baseConversionRate,
            visitorsPerDay,
            requiredSampleSizePerVariant,
            requiredRuntimeDays
        }
    } = experiment;

    let analysisDone = false;
    let trustworthy = EXPERIMENT_TRUSTWORTHY.NO;
    let decision = EXPERIMENT_DECISION.KEEP_RUNNING;
    let followUp = EXPERIMENT_FOLLOW_UP.DO_NOTHING;

    const { pValue: ratioPValue } = checkSampleRatioMismatch(actualVisitorsBase, actualVisitorsVariant);
    const hasSampleRatioMismatch = ratioPValue < 0.0001;

    const actualBaseRate = actualConversionsBase / actualVisitorsBase;
    const baseRateDifference = Math.abs(actualBaseRate - baseConversionRate) / baseConversionRate;
    const hasBaseRateMismatch = baseRateDifference > 0.05;

    const actualDailyTraffic = (actualVisitorsBase + actualVisitorsVariant) / currentRuntimeDays;
    const trafficDifference = (actualDailyTraffic - visitorsPerDay) / visitorsPerDay;
    const hasTrafficMismatch = trafficDifference < -0.05;
    const lowSampleSize = actualVisitorsBase < requiredSampleSizePerVariant || actualVisitorsVariant < requiredSampleSizePerVariant;

    const businessCycleComplete = currentRuntimeDays % businessCycleDays === 0;
    const fullWeek = currentRuntimeDays >= 7;

    const mismatch = hasSampleRatioMismatch || 
                     hasBaseRateMismatch || 
                     hasTrafficMismatch;

    if (mismatch) {
        trustworthy = EXPERIMENT_TRUSTWORTHY.NO;
        decision = EXPERIMENT_DECISION.KEEP_BASE;
        followUp = EXPERIMENT_FOLLOW_UP.RERUN;
        analysisDone = true;
    } else if (lowSampleSize) {
        trustworthy = EXPERIMENT_TRUSTWORTHY.YES;
        decision = EXPERIMENT_DECISION.KEEP_RUNNING;
        analysisDone = true;
    } else if (!businessCycleComplete || !fullWeek) {
        trustworthy = EXPERIMENT_TRUSTWORTHY.NO;
        decision = EXPERIMENT_DECISION.KEEP_RUNNING;
        analysisDone = true;
    } else {
        trustworthy = EXPERIMENT_TRUSTWORTHY.YES;
    }

    // trustworthy, complete, and enough sample size, compute the decision and follow up
    const isSignificant = pValue < alpha;
    if (!analysisDone && !isSignificant) {
        decision = EXPERIMENT_DECISION.KEEP_BASE;
        followUp = EXPERIMENT_FOLLOW_UP.ITERATE;
        analysisDone = true;
    }

    // trustworthy, complete, and significant, check if the effect is positive
    const isEffectPositive = actualConversionsBase < actualConversionsVariant;
    if (!analysisDone && !isEffectPositive) {
        decision = EXPERIMENT_DECISION.KEEP_BASE;
        followUp = EXPERIMENT_FOLLOW_UP.ITERATE;
        analysisDone = true;
    } else {
        if (!analysisDone) {
            decision = EXPERIMENT_DECISION.KEEP_VARIANT; 
            followUp = EXPERIMENT_FOLLOW_UP.CELEBRATE;
        }
    }

    return {
        decision:{
            trustworthy: trustworthy,
            decision: decision,
            follwUp: followUp
        },
        analysis: {
            hasSignificantRatioMismatch: hasSampleRatioMismatch,
            hasBaseRateMismatch,
            hasTrafficMismatch,
            hasInsufficientSampleSize: lowSampleSize,
            hasIncompleteBusinessCycle: !businessCycleComplete,
            ratioMismatch: {
                pValue: ratioPValue
            },
            baseRate: {
                expected: baseConversionRate,
                actual: actualBaseRate,
                difference: baseRateDifference
            },
            traffic: {
                expected: visitorsPerDay,
                actual: actualDailyTraffic,
                difference: trafficDifference
            },
            sampleSize: {
                required: requiredSampleSizePerVariant,
                actualBase: actualVisitorsBase,
                actualVariant: actualVisitorsVariant
            },
            runtime: {
                current: currentRuntimeDays,
                required: requiredRuntimeDays,
                businessCycleDays
            }
        }
    };
}

window.generateABTestChallenge = generateABTestChallenge;
window.analyzeExperiment = analyzeExperiment;