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
    // Create an array of random weights
    const weights = Array.from({length: numDays}, () => Math.random());
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    // Distribute visitors according to weights
    const dailyVisitors = weights.map(weight => Math.round((weight / totalWeight) * totalVisitors));

    // Adjust for rounding errors
    const currentTotal = dailyVisitors.reduce((a, b) => a + b, 0);
    const diff = totalVisitors - currentTotal;
    if (diff !== 0) {
        dailyVisitors[0] += diff; // Add any rounding difference to first day
    }

    return dailyVisitors;
}

function generateABTestChallenge() {
    // Predefined options for each parameter
    const ALPHA_OPTIONS = [0.1, 0.05, 0.2, 0.01];
    const BETA_OPTIONS = [0.2, 0.1, 0.01, 0.3];
    const BASE_CONVERSION_RATE_OPTIONS = [0.012, 0.523, 0.117, 0.231, 0.654];
    const MRE_OPTIONS = [0.01, 0.02, 0.03, 0.04, 0.05];
    const VISITORS_PER_DAY_OPTIONS = [150, 1200, 25000, 47000, 128000, 200000];
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

    const actualVisitorsTotal = Math.round(VISITORS_PER_DAY * BUSINESS_CYCLE_DAYS);
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

    // Generate daily data for entire runtime
    const baseVisitorsPerDay = distributeDailyVisitors(actualVisitorsBase, requiredRuntimeDays);
    const variantVisitorsPerDay = distributeDailyVisitors(actualVisitorsVariant, requiredRuntimeDays);

    // Initialize cumulative counters
    let cumulativeBaseVisitors = 0;
    let cumulativeBaseConversions = 0;
    let cumulativeVariantVisitors = 0;
    let cumulativeVariantConversions = 0;

    const dailyData = Array.from({ length: requiredRuntimeDays }, (_, i) => {
        const baseVisitors = baseVisitorsPerDay[i];
        const variantVisitors = variantVisitorsPerDay[i];

        // Sample conversions using the overall conversion rates
        const baseConversions = sampleBinomial(baseVisitors, actualBaseConversionRate);
        const variantConversions = sampleBinomial(variantVisitors, variantConversionRate);

        // Update cumulative counters
        cumulativeBaseVisitors += baseVisitors;
        cumulativeBaseConversions += baseConversions;
        cumulativeVariantVisitors += variantVisitors;
        cumulativeVariantConversions += variantConversions;

        // Calculate daily rates
        const baseRate = baseConversions / baseVisitors;
        const variantRate = variantConversions / variantVisitors;

        // Calculate cumulative rates
        const baseCumulativeRate = cumulativeBaseConversions / cumulativeBaseVisitors;
        const variantCumulativeRate = cumulativeVariantConversions / cumulativeVariantVisitors;

        // Calculate confidence intervals using experiment's alpha
        const baseDailyCI = computeConfidenceInterval(baseRate, baseVisitors, ALPHA);
        const variantDailyCI = computeConfidenceInterval(variantRate, variantVisitors, ALPHA);
        const baseCumulativeCI = computeConfidenceInterval(baseCumulativeRate, cumulativeBaseVisitors, ALPHA);
        const variantCumulativeCI = computeConfidenceInterval(variantCumulativeRate, cumulativeVariantVisitors, ALPHA);

        return {
            base: {
                visitors: baseVisitors,
                conversions: baseConversions,
                rate: baseRate,
                rateCI: baseDailyCI,
                cumulativeVisitors: cumulativeBaseVisitors,
                cumulativeConversions: cumulativeBaseConversions,
                cumulativeRate: baseCumulativeRate,
                cumulativeRateCI: baseCumulativeCI
            },
            variant: {
                visitors: variantVisitors,
                conversions: variantConversions,
                rate: variantRate,
                rateCI: variantDailyCI,
                cumulativeVisitors: cumulativeVariantVisitors,
                cumulativeConversions: cumulativeVariantConversions,
                cumulativeRate: variantCumulativeRate,
                cumulativeRateCI: variantCumulativeCI
            }
        };
    });

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