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
    const se = Math.sqrt((conversionRate * (1 - conversionRate)) / visitors);
    const zScore = jStat.normal.inv(1 - alpha / 2, 0, 1);
    const marginOfError = zScore * se;

    return [
        Math.max(0, conversionRate - marginOfError),
        Math.min(1, conversionRate + marginOfError)
    ];
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

    const observedBaseRate = actualConversionsBase / actualVisitorsBase;
    const observedVariantRate = actualConversionsVariant / actualVisitorsVariant;

    const ciBase = computeConfidenceInterval(observedBaseRate, actualVisitorsBase, ALPHA);
    const ciVariant = computeConfidenceInterval(observedVariantRate, actualVisitorsVariant, ALPHA);

    // Calculate difference CI directly using pooled standard error
    const observedDifference = observedVariantRate - observedBaseRate;
    const pooledSE = Math.sqrt(
        (observedBaseRate * (1 - observedBaseRate)) / actualVisitorsBase +
        (observedVariantRate * (1 - observedVariantRate)) / actualVisitorsVariant
    );
    const zScore = jStat.normal.inv(1 - ALPHA / 2, 0, 1);
    const diffMarginOfError = zScore * pooledSE;
    const ciDifference = [
        observedDifference - diffMarginOfError,
        observedDifference + diffMarginOfError
    ];

    // Generate daily data for time series visualization
    const dailyData = Array.from({ length: BUSINESS_CYCLE_DAYS }, () => ({
        base: sampleBinomial(VISITORS_PER_DAY / 2, actualBaseConversionRate) / (VISITORS_PER_DAY / 2),
        variant: sampleBinomial(VISITORS_PER_DAY / 2, variantConversionRate) / (VISITORS_PER_DAY / 2)
    }));

    return {
        experiment: {
            alpha: ALPHA,
            beta: BETA,
            baseConversionRate: BASE_CONVERSION_RATE,
            minimumRelevantEffect: MRE,
            visitorsPerDay: VISITORS_PER_DAY,
            businessCycleDays: BUSINESS_CYCLE_DAYS
        },
        simulation: {
            actualBaseConversionRate: observedBaseRate,
            actualEffectSize: actualEffectSize,
            variantConversionRate: observedVariantRate,
            actualVisitorsBase: actualVisitorsBase,
            actualVisitorsVariant: actualVisitorsVariant,
            actualConversionsBase: actualConversionsBase,
            actualConversionsVariant: actualConversionsVariant,
            pValue: pValue,
            confidenceIntervalBase: ciBase,
            confidenceIntervalVariant: ciVariant,
            confidenceIntervalDifference: ciDifference,
            dailyData: dailyData
        }
    };
}

window.generateABTestChallenge = generateABTestChallenge;