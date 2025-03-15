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
    // Standard error calculation for proportion
    const se = Math.sqrt((conversionRate * (1 - conversionRate)) / visitors);
    // Z-score for the given alpha (e.g., 1.96 for 95% CI)
    const zScore = jStat.normal.inv(1 - alpha / 2, 0, 1);
    const marginOfError = zScore * se;

    // Return symmetric bounds around the conversion rate
    return [
        Math.max(0, conversionRate - marginOfError),
        Math.min(1, conversionRate + marginOfError)
    ];
}

function generateABTestChallenge(level = 1) {
    const difficultySettings = {
        1: { mre: 0.02, visitors: 1000, noise: 0.001 },
        2: { mre: 0.015, visitors: 800, noise: 0.002 },
        3: { mre: 0.01, visitors: 600, noise: 0.003 },
        4: { mre: 0.008, visitors: 400, noise: 0.004 },
        5: { mre: 0.005, visitors: 200, noise: 0.005 }
    };

    const settings = difficultySettings[level] || difficultySettings[1];

    const ALPHA = 0.05;
    const BETA = 0.2;
    const BASE_CONVERSION_RATE = 0.12;
    const MRE = settings.mre;
    const VISITORS_PER_DAY = settings.visitors;
    const BUSINESS_CYCLE_DAYS = 14;

    const actualBaseConversionRate = sampleBetaDistribution(
        100000 * BASE_CONVERSION_RATE,
        100000 * (1 - BASE_CONVERSION_RATE)
    );

    const actualEffectSize = sampleNormalDistribution(MRE, settings.noise);
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
        level,
        experiment: {
            alpha: ALPHA,
            beta: BETA,
            baseConversionRate: BASE_CONVERSION_RATE,
            minimumRelevantEffect: MRE,
            visitorsPerDay: VISITORS_PER_DAY,
            businessCycleDays: BUSINESS_CYCLE_DAYS
        },
        simulation: {
            actualBaseConversionRate: actualBaseConversionRate,
            actualEffectSize: actualEffectSize,
            variantConversionRate: variantConversionRate,
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