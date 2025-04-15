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

    var successes = 0;
    for (var i = 0; i < n; i++) {
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
    return [conversionRate - marginOfError, conversionRate + marginOfError];
}

function generateABTestChallenge() {
    var ALPHA = 0.1;
    var BETA = 0.2;
    var BASE_CONVERSION_RATE = 0.12;
    var MRE = 0.01;
    var VISITORS_PER_DAY = 1200;
    var BUSINESS_CYCLE_DAYS = 1;

    var actualBaseConversionRate = sampleBetaDistribution(
        100000 * BASE_CONVERSION_RATE,
        100000 * (1 - BASE_CONVERSION_RATE)
    );

    var actualEffectSize = sampleNormalDistribution(MRE, MRE / 10);
    if (Math.random() < 0.5) {
        actualEffectSize = -actualEffectSize;
    }

    var variantConversionRate = actualBaseConversionRate + actualEffectSize;
    var actualVisitorsTotal = Math.round(VISITORS_PER_DAY * BUSINESS_CYCLE_DAYS);
    var actualVisitorsBase = sampleBinomial(actualVisitorsTotal, 0.5);
    var actualVisitorsVariant = actualVisitorsTotal - actualVisitorsBase;

    var actualConversionsBase = sampleBinomial(actualVisitorsBase, actualBaseConversionRate);
    var actualConversionsVariant = sampleBinomial(actualVisitorsVariant, variantConversionRate);

    var tTestResult = computeTTest(actualConversionsBase, actualVisitorsBase, actualConversionsVariant, actualVisitorsVariant);
    var pValue = tTestResult.pValue;

    var ciBase = computeConfidenceInterval(actualBaseConversionRate, actualVisitorsBase, ALPHA);
    var ciVariant = computeConfidenceInterval(variantConversionRate, actualVisitorsVariant, ALPHA);
    var ciDifference = [ciVariant[0] - ciBase[1], ciVariant[1] - ciBase[0]];

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
            confidenceIntervalDifference: ciDifference
        }
    };
}

window.generateABTestChallenge = generateABTestChallenge;
