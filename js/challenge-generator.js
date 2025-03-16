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

function distributeConversions(totalConversions, dailyVisitors) {
    const numDays = dailyVisitors.length;
    const conversionRate = totalConversions / dailyVisitors.reduce((sum, v) => sum + v, 0);

    // Distribute conversions proportionally to visitors
    const dailyConversions = dailyVisitors.map(visitors =>
        Math.round(visitors * conversionRate)
    );

    // Adjust to match total
    const currentTotal = dailyConversions.reduce((sum, v) => sum + v, 0);
    const diff = totalConversions - currentTotal;

    if (diff !== 0) {
        // Add remaining conversions to the first day that has enough visitors
        for (let i = 0; i < numDays; i++) {
            if (dailyConversions[i] + diff <= dailyVisitors[i]) {
                dailyConversions[i] += diff;
                break;
            }
        }
    }

    return dailyConversions;
}

function generateDailyData(baseVisitors, variantVisitors, baseConversions, variantConversions, numDays, alpha) {
    // 1. First distribute visitors evenly
    let baseVisitorsPerDay = distributeDailyVisitors(baseVisitors, numDays);
    let variantVisitorsPerDay = distributeDailyVisitors(variantVisitors, numDays);

    // 2. Add weekly pattern variance
    baseVisitorsPerDay = addWeeklyPattern(baseVisitorsPerDay);
    variantVisitorsPerDay = addWeeklyPattern(variantVisitorsPerDay);

    // 3. Distribute conversions based on final visitor numbers
    const baseConversionsPerDay = distributeConversions(baseConversions, baseVisitorsPerDay);
    const variantConversionsPerDay = distributeConversions(variantConversions, variantVisitorsPerDay);

    // 4. Calculate daily and cumulative metrics
    let cumulativeBaseVisitors = 0;
    let cumulativeBaseConversions = 0;
    let cumulativeVariantVisitors = 0;
    let cumulativeVariantConversions = 0;

    return Array.from({ length: numDays }, (_, i) => {
        // Update cumulative counters
        cumulativeBaseVisitors += baseVisitorsPerDay[i];
        cumulativeBaseConversions += baseConversionsPerDay[i];
        cumulativeVariantVisitors += variantVisitorsPerDay[i];
        cumulativeVariantConversions += variantConversionsPerDay[i];

        // Calculate rates and CIs
        const baseRate = baseVisitorsPerDay[i] === 0 ? 0 : baseConversionsPerDay[i] / baseVisitorsPerDay[i];
        const variantRate = variantVisitorsPerDay[i] === 0 ? 0 : variantConversionsPerDay[i] / variantVisitorsPerDay[i];
        const baseCumulativeRate = cumulativeBaseVisitors === 0 ? 0 : cumulativeBaseConversions / cumulativeBaseVisitors;
        const variantCumulativeRate = cumulativeVariantVisitors === 0 ? 0 : cumulativeVariantConversions / cumulativeVariantVisitors;

        return {
            base: {
                visitors: baseVisitorsPerDay[i],
                conversions: baseConversionsPerDay[i],
                rate: baseRate,
                rateCI: computeConfidenceInterval(baseRate, baseVisitorsPerDay[i], alpha),
                cumulativeVisitors: cumulativeBaseVisitors,
                cumulativeConversions: cumulativeBaseConversions,
                cumulativeRate: baseCumulativeRate,
                cumulativeRateCI: computeConfidenceInterval(baseCumulativeRate, cumulativeBaseVisitors, alpha)
            },
            variant: {
                visitors: variantVisitorsPerDay[i],
                conversions: variantConversionsPerDay[i],
                rate: variantRate,
                rateCI: computeConfidenceInterval(variantRate, variantVisitorsPerDay[i], alpha),
                cumulativeVisitors: cumulativeVariantVisitors,
                cumulativeConversions: cumulativeVariantConversions,
                cumulativeRate: variantCumulativeRate,
                cumulativeRateCI: computeConfidenceInterval(variantCumulativeRate, cumulativeVariantVisitors, alpha)
            }
        };
    });
}

function generateABTestChallenge() {
    // Predefined options for each parameter
    const ALPHA_OPTIONS = [0.1, 0.05, 0.2, 0.01];
    const BETA_OPTIONS = [0.2, 0.1, 0.01, 0.3];
    const BASE_CONVERSION_RATE_OPTIONS = [0.012, 0.523, 0.117, 0.231, 0.654];
    const MRE_OPTIONS = [0.001, 0.002, 0.01];
    const VISITORS_PER_DAY_OPTIONS = [150, 1200, 25000, 47000];
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

    const actualEffectSize = sampleNormalDistribution(MRE, MRE / 10);
    const variantConversionRate = actualBaseConversionRate + (Math.random() < 0.5 ? actualEffectSize : -actualEffectSize);

    const actualVisitorsTotal = requiredRuntimeDays * VISITORS_PER_DAY + sampleBinomial(VISITORS_PER_DAY, 0.8);
    const actualVisitorsBase = sampleBinomial(actualVisitorsTotal, 0.5);
    const actualVisitorsVariant = actualVisitorsTotal - actualVisitorsBase;

    const actualConversionsBase = sampleBinomial(actualVisitorsBase, actualBaseConversionRate);
    const actualConversionsVariant = sampleBinomial(actualVisitorsVariant, variantConversionRate);

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

    // Generate daily data using the new function
    const dailyData = generateDailyData(
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
            actualEffectSize: actualEffectSize,
            variantConversionRate: actualVariantRate,
            actualVisitorsBase: actualVisitorsBase,
            actualVisitorsVariant: actualVisitorsVariant,
            actualConversionsBase: actualConversionsBase,
            actualConversionsVariant: actualConversionsVariant,
            pValue: pValue,
            confidenceIntervalBase: ciBase,
            confidenceIntervalVariant: ciVariant,
            confidenceIntervalDifference: ciDifference,
            dailyData: dailyData,
            uplift: conversionRateUplift,
            upliftConfidenceInterval: upliftCI,
            visitorUplift: visitorUplift,
            conversionUplift: conversionUplift
        }
    };
}

window.generateABTestChallenge = generateABTestChallenge;