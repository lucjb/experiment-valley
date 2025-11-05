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

function sampleMultinomial(n, probs) {
    // Sample multinomial distribution: allocate n items across categories with probabilities probs
    // Returns an array of counts, one per category
    const k = probs.length;
    if (k === 0 || n === 0) return new Array(k).fill(0);
    
    // Normalize probabilities to sum to 1
    const sumP = probs.reduce((a, b) => a + b, 0);
    if (sumP === 0) {
        // If all probabilities are zero, distribute evenly
        const evenShare = Math.floor(n / k);
        const remainder = n % k;
        const counts = new Array(k).fill(evenShare);
        for (let i = 0; i < remainder; i++) {
            counts[i]++;
        }
        return counts;
    }
    
    // Normalize probabilities once at the start
    const normProbs = probs.map(p => p / sumP);
    const counts = new Array(k).fill(0);
    
    let remaining = n;
    // Sequential binomial sampling approach
    for (let i = 0; i < k - 1 && remaining > 0; i++) {
        // Compute conditional probability: P(i | not selected 0..i-1)
        // This is the probability of category i given remaining items
        const remainingSum = normProbs.slice(i).reduce((a, b) => a + b, 0);
        if (remainingSum <= 0) break;
        
        const conditionalP = normProbs[i] / remainingSum;
        const p = Math.max(0, Math.min(1, conditionalP));
        const count = sampleBinomial(remaining, p);
        counts[i] = count;
        remaining -= count;
    }
    // Last category gets the remainder
    counts[k - 1] = remaining;
    
    return counts;
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

function calculateActualPower(effectSize, sampleSize, varianceA, varianceB, alpha) {
    var zAlpha = jStat.normal.inv(1 - alpha / 2, 0, 1);
    var se = Math.sqrt((varianceA + varianceB) / sampleSize);
    var zBeta = (effectSize / se) - zAlpha;
    return jStat.normal.cdf(zBeta, 0, 1);
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
    // Number of swaps to perform - reduced to minimize false positives in lucky day detection
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
            // Move a smaller random amount to reduce noise magnitude
            const amount = Math.min(
                maxFromPeriod1,
                maxToPeriod2,
                Math.max(1, Math.floor(Math.random() * Math.min(maxFromPeriod1 / 3, maxToPeriod2)))
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

// Constraint: prevent one variant's conversion rate from being more than 2x the other's on any day
// This ensures realistic day-to-day variation without extreme outliers
function enforceConversionRateConstraint(
    baseConversionsPerPeriod,
    baseVisitorsPerPeriod,
    variantConversionsPerPeriod,
    variantVisitorsPerPeriod,
    totalBaseConversions,
    totalVariantConversions
) {
    const numPeriods = baseConversionsPerPeriod.length;
    
    // Create copies to avoid mutating originals
    let adjustedBaseConversions = [...baseConversionsPerPeriod];
    let adjustedVariantConversions = [...variantConversionsPerPeriod];
    
    // Iteratively enforce constraint until no violations remain (or max iterations)
    let maxIterations = 10;
    let iteration = 0;
    let hasViolation = true;
    
    while (hasViolation && iteration < maxIterations) {
        hasViolation = false;
        iteration++;
        
        // Check each period for violations
        for (let i = 0; i < numPeriods; i++) {
            const baseVisitors = baseVisitorsPerPeriod[i];
            const variantVisitors = variantVisitorsPerPeriod[i];
            
            if (baseVisitors <= 0 || variantVisitors <= 0) {
                continue; // Skip periods with no visitors
            }
            
            const baseConvs = adjustedBaseConversions[i];
            const variantConvs = adjustedVariantConversions[i];
            
            if (baseConvs <= 0 || variantConvs <= 0) {
                continue; // Skip periods with no conversions
            }
            
            const baseRate = baseConvs / baseVisitors;
            const variantRate = variantConvs / variantVisitors;
            
            // Check if constraint is violated
            const ratio1 = variantRate / baseRate;
            const ratio2 = baseRate / variantRate;
            
            if (ratio1 > MAX_RATE_RATIO) {
                // Variant rate is too high - reduce variant conversions
                const maxVariantRate = baseRate * MAX_RATE_RATIO;
                const maxVariantConvs = Math.floor(variantVisitors * maxVariantRate);
                const reduction = variantConvs - maxVariantConvs;
                
                if (reduction > 0) {
                    adjustedVariantConversions[i] = maxVariantConvs;
                    hasViolation = true;
                    // Redistribute the reduction to other periods
                    redistributeConversions(
                        adjustedVariantConversions, 
                        variantVisitorsPerPeriod, 
                        reduction, 
                        i, 
                        totalVariantConversions
                    );
                }
            } else if (ratio2 > MAX_RATE_RATIO) {
                // Base rate is too high - reduce base conversions
                const maxBaseRate = variantRate * MAX_RATE_RATIO;
                const maxBaseConvs = Math.floor(baseVisitors * maxBaseRate);
                const reduction = baseConvs - maxBaseConvs;
                
                if (reduction > 0) {
                    adjustedBaseConversions[i] = maxBaseConvs;
                    hasViolation = true;
                    // Redistribute the reduction to other periods
                    redistributeConversions(
                        adjustedBaseConversions, 
                        baseVisitorsPerPeriod, 
                        reduction, 
                        i, 
                        totalBaseConversions
                    );
                }
            }
        }
    }
    
    return {
        baseConversionsPerPeriod: adjustedBaseConversions,
        variantConversionsPerPeriod: adjustedVariantConversions
    };
}

// Helper: Redistribute conversions that were removed due to constraint violation
function redistributeConversions(conversions, visitorsPerPeriod, amountToRedistribute, excludeIndex, targetTotal) {
    if (amountToRedistribute <= 0) return;
    
    const numPeriods = conversions.length;
    const currentTotal = conversions.reduce((sum, val) => sum + val, 0);
    const target = targetTotal;
    
    // Find periods that can accept more conversions (excluding the period we're adjusting)
    const eligiblePeriods = [];
    for (let i = 0; i < numPeriods; i++) {
        if (i !== excludeIndex && visitorsPerPeriod[i] > 0) {
            const capacity = visitorsPerPeriod[i] - conversions[i];
            if (capacity > 0) {
                eligiblePeriods.push({ index: i, capacity });
            }
        }
    }
    
    if (eligiblePeriods.length === 0) return;
    
    // Distribute proportionally to capacity
    const totalCapacity = eligiblePeriods.reduce((sum, p) => sum + p.capacity, 0);
    let remaining = amountToRedistribute;
    
    for (const period of eligiblePeriods) {
        if (remaining <= 0) break;
        const share = Math.floor((amountToRedistribute * period.capacity) / totalCapacity);
        const addition = Math.min(period.capacity, share, remaining);
        conversions[period.index] += addition;
        remaining -= addition;
    }
    
    // Distribute any remainder one at a time
    for (const period of eligiblePeriods) {
        if (remaining <= 0) break;
        if (conversions[period.index] < visitorsPerPeriod[period.index]) {
            conversions[period.index]++;
            remaining--;
        }
    }
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

function findLuckyPeriodIndex(visitorsPerPeriod) {
    // Find all periods that have visitors
    const periodsWithVisitors = [];

    for (let index = 0; index < visitorsPerPeriod.length; index++) {
        if (visitorsPerPeriod[index] > 0) {
            periodsWithVisitors.push(index);
        }
    }

    // If no periods have visitors, return -1
    if (periodsWithVisitors.length === 0) {
        return -1;
    }

    // Pick a random period from those with visitors
    const randomIndex = Math.floor(Math.random() * periodsWithVisitors.length);
    return periodsWithVisitors[randomIndex];
}

function applyLuckyDayTrapToVariantConversions({
    baseVisitorsPerPeriod,
    baseConversionsPerPeriod,
    variantVisitorsPerPeriod,
    variantConversionsPerPeriod,
    totalVariantConversions,
    totalBaseConversions,
    improvementDirection
}) {
    // Pick a random day that has visitors
    const luckyIndex = findLuckyPeriodIndex(variantVisitorsPerPeriod);
    if (luckyIndex === -1) {
        return variantConversionsPerPeriod;
    }

    const luckyDayBaseVisitors = baseVisitorsPerPeriod[luckyIndex];
    const luckyDayVariantVisitors = variantVisitorsPerPeriod[luckyIndex];
    const luckyDayBaseConversions = baseConversionsPerPeriod[luckyIndex];
    const currentVariantConversions = variantConversionsPerPeriod[luckyIndex];

    if (luckyDayBaseVisitors <= 0 || luckyDayVariantVisitors <= 0) {
        return variantConversionsPerPeriod;
    }

    // Calculate base rate for the lucky day
    const baseRate = luckyDayBaseConversions / luckyDayBaseVisitors;

    // Determine improvement direction
    const isHigherBetter = improvementDirection === IMPROVEMENT_DIRECTION.HIGHER || improvementDirection === 'HIGHER';
    
    // Calculate minimum variant conversions needed to meet the 2x ratio requirement
    let minVariantConversions;
    if (isHigherBetter) {
        // Higher is better: variant rate >= 2 * base rate
        // variantRate = variantConvs / variantVisitors >= 2 * baseRate
        // variantConvs >= 2 * baseRate * variantVisitors
        minVariantConversions = Math.ceil(MAX_RATE_RATIO * baseRate * luckyDayVariantVisitors);
    } else {
        // Lower is better: base rate >= 2 * variant rate
        // baseRate >= 2 * variantRate
        // variantRate <= baseRate / 2
        // variantConvs <= (baseRate / 2) * variantVisitors
        minVariantConversions = Math.floor((baseRate / MAX_RATE_RATIO) * luckyDayVariantVisitors);
    }

    // Ensure we don't exceed visitors
    minVariantConversions = Math.min(minVariantConversions, luckyDayVariantVisitors);
    minVariantConversions = Math.max(0, minVariantConversions);

    // Calculate how many conversions we need to add (or remove)
    const conversionsNeeded = minVariantConversions - currentVariantConversions;

    // Create a copy of conversions
    const updatedVariantConversions = [...variantConversionsPerPeriod];

    if (conversionsNeeded > 0) {
        // Need to add conversions to lucky day
        // Check if we have remaining capacity from total
        const currentTotal = variantConversionsPerPeriod.reduce((sum, val) => sum + val, 0);
        const remainingFromTotal = totalVariantConversions - currentTotal;
        
        // Add conversions to lucky day (up to its capacity)
        const availableCapacity = luckyDayVariantVisitors - currentVariantConversions;
        const conversionsToAdd = Math.min(conversionsNeeded, availableCapacity, remainingFromTotal);
        
        updatedVariantConversions[luckyIndex] += conversionsToAdd;
        
        // If we still need more and don't have remaining from total, redistribute from other days
        if (conversionsToAdd < conversionsNeeded && remainingFromTotal <= 0) {
            const stillNeeded = conversionsNeeded - conversionsToAdd;
            redistributeFromOtherDays(updatedVariantConversions, variantVisitorsPerPeriod, stillNeeded, luckyIndex);
        }
    } else if (conversionsNeeded < 0) {
        // Need to remove conversions from lucky day (shouldn't happen often, but possible)
        const excess = Math.abs(conversionsNeeded);
        updatedVariantConversions[luckyIndex] = minVariantConversions;
        redistributeToOtherDays(updatedVariantConversions, variantVisitorsPerPeriod, excess, luckyIndex);
    }

    // Ensure total matches (handle any rounding differences)
    const finalTotal = updatedVariantConversions.reduce((sum, val) => sum + val, 0);
    const diff = totalVariantConversions - finalTotal;
    
    if (diff !== 0) {
        adjustToMatchTotal(updatedVariantConversions, variantVisitorsPerPeriod, diff);
    }

        return updatedVariantConversions;
    }

// Helper: Redistribute conversions from other days to lucky day
function redistributeFromOtherDays(conversions, visitorsPerPeriod, amountNeeded, luckyIndex) {
    if (amountNeeded <= 0) return;
    
    const nonLuckyIndices = conversions
        .map((_, index) => index)
        .filter(index => index !== luckyIndex);

    // Find days with conversions to remove (prioritize days with more conversions)
    const eligibleDays = nonLuckyIndices
        .map(index => ({
            index,
            conversions: conversions[index]
        }))
        .filter(day => day.conversions > 0)
        .sort((a, b) => b.conversions - a.conversions); // Remove from highest first
    
    let remaining = amountNeeded;
    for (const day of eligibleDays) {
        if (remaining <= 0) break;
        const toRemove = Math.min(remaining, day.conversions);
        conversions[day.index] -= toRemove;
        remaining -= toRemove;
    }
    
    // Add to lucky day
    const availableCapacity = visitorsPerPeriod[luckyIndex] - conversions[luckyIndex];
    const toAdd = Math.min(amountNeeded - remaining, availableCapacity);
    conversions[luckyIndex] += toAdd;
}

// Helper: Redistribute conversions from lucky day to other days
function redistributeToOtherDays(conversions, visitorsPerPeriod, amountToRedistribute, luckyIndex) {
    if (amountToRedistribute <= 0) return;
    
    const nonLuckyIndices = conversions
        .map((_, index) => index)
        .filter(index => index !== luckyIndex);
    
    // Find days with capacity
    const eligibleDays = nonLuckyIndices
        .map(index => ({
            index,
            capacity: visitorsPerPeriod[index] - conversions[index]
        }))
        .filter(day => day.capacity > 0);
    
    if (eligibleDays.length === 0) return;
    
    // Distribute proportionally to capacity
    const totalCapacity = eligibleDays.reduce((sum, day) => sum + day.capacity, 0);
    let remaining = amountToRedistribute;
    
    for (const day of eligibleDays) {
        if (remaining <= 0) break;
        const share = Math.floor((amountToRedistribute * day.capacity) / totalCapacity);
        const addition = Math.min(day.capacity, share, remaining);
        conversions[day.index] += addition;
        remaining -= addition;
    }
    
    // Distribute remainder one at a time
    for (const day of eligibleDays) {
        if (remaining <= 0) break;
        if (conversions[day.index] < visitorsPerPeriod[day.index]) {
            conversions[day.index]++;
            remaining--;
        }
    }
}

// Helper: Adjust conversions to match target total
function adjustToMatchTotal(conversions, visitorsPerPeriod, diff) {
    if (diff === 0) return;
    
    const numPeriods = conversions.length;
        const adjustmentOrder = diff > 0
        ? Array.from({ length: numPeriods }, (_, i) => i)
            .sort((a, b) => (visitorsPerPeriod[b] - conversions[b]) - (visitorsPerPeriod[a] - conversions[a])) // Highest capacity first
        : Array.from({ length: numPeriods }, (_, i) => i)
            .sort((a, b) => conversions[b] - conversions[a]); // Highest conversions first
    
    let remaining = Math.abs(diff);
            for (const index of adjustmentOrder) {
        if (remaining <= 0) break;
        
        if (diff > 0) {
            // Need to add conversions
            const capacity = visitorsPerPeriod[index] - conversions[index];
            if (capacity > 0) {
                const addition = Math.min(capacity, remaining);
                conversions[index] += addition;
                remaining -= addition;
            }
        } else {
            // Need to remove conversions
            if (conversions[index] > 0) {
                conversions[index]--;
                remaining--;
            }
        }
    }
}

function generateTimelineData(baseVisitors, variantVisitors, baseConversions, variantConversions, numDays, alpha, currentRuntimeDays, businessCycleDays, dataLoss, options = {}) {
    // Determine appropriate time period
    const { period, numPeriods } = determineTimePeriod(numDays);
    const daysPerPeriod = period === 'day' ? 1 : period === 'week' ? 7 : 28;

    const { luckyDayTrap: enforceLuckyDayTrap = false, improvementDirection } = options;

    // Build a single total-traffic pattern for the timeline
    // This ensures both variants share the same underlying traffic pattern,
    // eliminating structural per-day SRM while preserving natural randomness
    const totalVisitors = baseVisitors + variantVisitors;
    let totalVisitorsPerPeriod = distributeDailyVisitors(totalVisitors, numPeriods);

    // Add appropriate pattern based on the period
    if (period === 'day') {
        totalVisitorsPerPeriod = addWeeklyPattern(totalVisitorsPerPeriod);
    } else if (period === 'week') {
        totalVisitorsPerPeriod = addMonthlyPattern(totalVisitorsPerPeriod);
    } else { // month
        totalVisitorsPerPeriod = addYearlyPattern(totalVisitorsPerPeriod);
    }

    // Allocate base visitors across periods using a multinomial draw
    // This preserves exact global totals while introducing natural per-period randomness
    // When SRM is not intended (global ratio ≈ 0.5), this avoids structural per-day SRM
    // When SRM is intended, the global ratio carries through to all periods
    const baseVisitorsPerPeriod = sampleMultinomial(
        baseVisitors,
        totalVisitorsPerPeriod.map(v => Math.max(0, v))
    );

    // Variant is the remainder per period (use let so it can be modified by data loss)
    let variantVisitorsPerPeriod = totalVisitorsPerPeriod.map((v, i) => Math.max(0, v - baseVisitorsPerPeriod[i]));

    // Distribute conversions
    var baseConversionsPerPeriod = distributeConversions(baseConversions, baseVisitorsPerPeriod);
    var variantConversionsPerPeriod = distributeConversions(variantConversions, variantVisitorsPerPeriod);

    // Enforce constraint: prevent one variant's conversion rate from being more than 2x the other's on any day
    const constrainedConversions = enforceConversionRateConstraint(
        baseConversionsPerPeriod,
        baseVisitorsPerPeriod,
        variantConversionsPerPeriod,
        variantVisitorsPerPeriod,
        baseConversions,
        variantConversions
    );
    baseConversionsPerPeriod = constrainedConversions.baseConversionsPerPeriod;
    variantConversionsPerPeriod = constrainedConversions.variantConversionsPerPeriod;

    if (enforceLuckyDayTrap) {
        variantConversionsPerPeriod = applyLuckyDayTrapToVariantConversions({
            baseVisitorsPerPeriod,
            baseConversionsPerPeriod,
            variantVisitorsPerPeriod,
            variantConversionsPerPeriod,
            totalVariantConversions: variantConversions,
            totalBaseConversions: baseConversions,
            improvementDirection
        });
    }

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
        overdue = false,
        underpoweredDesign = false,
        luckyDayTrap = false
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
        this.underpoweredDesign = underpoweredDesign;
        this.luckyDayTrap = luckyDayTrap;
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
            this.overdue,
            this.underpoweredDesign,
            this.luckyDayTrap
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

    withUnderpoweredDesign() {
        this.underpoweredDesign = true;
        return this;
    }

    withLuckyDayTrap() {
        this.luckyDayTrap = true;
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
        sampleProgress: SAMPLE_PROGRESS.PARTIAL
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

function luckyDayTrap() {
    return new ChallengeDesign({
        timeProgress: TIME_PROGRESS.FULL,
        baseRateMismatch: BASE_RATE_MISMATCH.NO,
        effectSize: EFFECT_SIZE.IMPROVEMENT,
        sampleRatioMismatch: SAMPLE_RATIO_MISMATCH.NO,
        sampleProgress: SAMPLE_PROGRESS.TIME,
        luckyDayTrap: true
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

function underpoweredTrap() {
    return new ChallengeDesign({
        timeProgress: TIME_PROGRESS.FULL,
        baseRateMismatch: BASE_RATE_MISMATCH.NO,
        effectSize: EFFECT_SIZE.SMALL_IMPROVEMENT,
        sampleRatioMismatch: SAMPLE_RATIO_MISMATCH.NO,
        sampleProgress: SAMPLE_PROGRESS.FULL,
        underpoweredDesign: true
    });
}



const TIME_PROGRESS = { FULL: "FULL", PARTIAL: "PARTIAL", EARLY: "EARLY", PARTIAL_WEEKS: "PARTIAL_WEEKS" };
const SAMPLE_PROGRESS = { FULL: "FULL", PARTIAL: "PARTIAL", TIME: "TIME" };
const BASE_RATE_MISMATCH = { NO: 1, YES: 0.1 };
const EFFECT_SIZE = { NONE: 0, SMALL_IMPROVEMENT: 0.05, IMPROVEMENT: 0.85, LARGE_IMPROVEMENT: 2, DEGRADATION: -0.8, SMALL_DEGRADATION: -0.05, LARGE_DEGRADATION: -2 };
const SAMPLE_RATIO_MISMATCH = { NO: 0.5, LARGE: 0.4, SMALL: 0.47 };
const VISITORS_LOSS = { NO: false, YES: true };
const IMPROVEMENT_DIRECTION = { HIGHER: 'HIGHER_IS_BETTER', LOWER: 'LOWER_IS_BETTER' };
const MAX_RATE_RATIO = 2.5;

function generateABTestChallenge(
    timeProgress = TIME_PROGRESS.FULL,
    baseRateMismatch = BASE_RATE_MISMATCH.NO,
    effectSize = EFFECT_SIZE.NONE,
    sampleRatioMismatch = SAMPLE_RATIO_MISMATCH.NO,
    sampleProgress = SAMPLE_PROGRESS.TIME,
    visitorsLoss = VISITORS_LOSS.NO,
    improvementDirection = IMPROVEMENT_DIRECTION.HIGHER,
    twymanFabrication = false,
    overdue = false,
    underpoweredDesign = false,
    luckyDayTrap = false) {

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
    var requiredSampleSizePerVariant = underpoweredDesign
        ? solveSampleSizeTTest(MRE, 2 * ALPHA, varianceA, varianceB, ALPHA)
        : solveSampleSizeTTest(MRE, 1 - BETA, varianceA, varianceB, ALPHA);
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
    extraDays = 0;
    if (overdue) {
        // Experiment ran longer than planned - add a random number of extra days (not always full weeks)
        extraDays = Math.floor(Math.random() * 21) + 1; // 1..21 extra days
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

    if (sampleProgress == SAMPLE_PROGRESS.PARTIAL && timeProgress == TIME_PROGRESS.PARTIAL) {
        observedVisitorsTotal = Math.min(observedVisitorsTotal, Math.floor(requiredSampleSizePerVariant * 1.95));
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
        visitorsLoss,
        { luckyDayTrap, improvementDirection }
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
            conversionUplift: conversionUplift,
            luckyDayTrap: luckyDayTrap
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

// Helper: Calculate period rate differences from time points
function calculatePeriodRateDiffs(timePoints, directionFactor) {
    const periodRateDiffs = [];
    
    timePoints.forEach((point, index) => {
        if (point.base.visitors === 0 || point.variant.visitors === 0) {
            return; // Skip periods with no data
        }
        
        const periodBaseRate = point.base.conversions / point.base.visitors;
        const periodVariantRate = point.variant.conversions / point.variant.visitors;
        const rawDiff = periodVariantRate - periodBaseRate;
        const directionalDiff = directionFactor * rawDiff;
        
        periodRateDiffs.push({
            index,
            value: directionalDiff,
            point,
            visitors: point.base.visitors + point.variant.visitors,
            conversionsDiff: point.variant.conversions - point.base.conversions
        });
    });
    
    return periodRateDiffs;
}

// Helper: Calculate median of an array
function calculateMedian(values) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)];
}

// Helper: Calculate Median Absolute Deviation (MAD)
function calculateMAD(values, median) {
    const deviations = values.map(v => Math.abs(v - median));
    return calculateMedian(deviations);
}

// Helper: Calculate modified Z-scores using MAD
function calculateModifiedZScores(periodRateDiffs, median, mad) {
    const MODIFIED_Z_SCORE_CONSTANT = 0.6745; // Makes MAD comparable to standard deviation
    const MODIFIED_Z_SCORE_THRESHOLD = 3.2;
    
    const periodsWithZScore = periodRateDiffs.map(p => ({
        ...p,
        modifiedZScore: mad > 0 ? (MODIFIED_Z_SCORE_CONSTANT * (p.value - median)) / mad : 0
    }));
    
    const outlierPeriods = periodsWithZScore
        .filter(p => p.modifiedZScore > MODIFIED_Z_SCORE_THRESHOLD && p.value > 0)
        .sort((a, b) => b.value - a.value);
    
    return { periodsWithZScore, outlierPeriods, threshold: MODIFIED_Z_SCORE_THRESHOLD };
}

// Helper: Simple peak detection - find obvious single peaks
// A peak is an outlier if:
// 1. It's the maximum value
// 2. It's at least 3x larger than the second-highest value
// 3. It's positive
function detectOutliersUsingMAD(periodRateDiffs) {
    const diffValues = periodRateDiffs.map(p => p.value);
    
    if (diffValues.length < 3) {
        return { isValid: false, reason: 'Too few periods (< 3)' };
    }
    
    // Find the period with the maximum value
    const sortedByValue = [...periodRateDiffs].sort((a, b) => b.value - a.value);
    const maxPeriod = sortedByValue[0];
    const secondMaxPeriod = sortedByValue[1];
    
    const maxValue = maxPeriod.value;
    const secondMaxValue = secondMaxPeriod.value;
    
    // Only consider positive values
    if (maxValue <= 0) {
        return { isValid: false, reason: 'No positive outliers found' };
    }
    
    // Simple check: max must be at least 3x larger than second-max
    const PEAK_MULTIPLIER = 3.0;
    const isObviousPeak = maxValue >= PEAK_MULTIPLIER * Math.max(secondMaxValue, 0);
    
    console.log('📊 Simple peak detection:', {
        maxPeriod: maxPeriod.index,
        maxValue: maxValue.toFixed(6),
        secondMaxPeriod: secondMaxPeriod.index,
        secondMaxValue: secondMaxValue.toFixed(6),
        ratio: (maxValue / Math.max(secondMaxValue, 0.0001)).toFixed(2),
        isObviousPeak
    });
    
    if (!isObviousPeak) {
        return { isValid: false, reason: 'No obvious single peak found' };
    }
    
    // Simple peak detection doesn't need z-scores or MAD
    const outlierPeriod = maxPeriod;
    
    console.log('✅ Single obvious peak found:', {
        period: outlierPeriod.index,
        value: maxValue.toFixed(6),
        secondMax: secondMaxValue.toFixed(6),
        ratio: (maxValue / Math.max(secondMaxValue, 0.0001)).toFixed(2)
    });
    
    return { 
        isValid: true, 
        outlierPeriods: [outlierPeriod]
    };
}

// Helper: Calculate adjusted experiment statistics after removing lucky day
function calculateAdjustedExperiment(experiment, luckyPeriod) {
    const {
        simulation: {
            actualConversionsBase,
            actualConversionsVariant,
            actualVisitorsBase,
            actualVisitorsVariant
        }
    } = experiment;
    
    const adjustedBaseConversions = actualConversionsBase - luckyPeriod.point.base.conversions;
    const adjustedVariantConversions = actualConversionsVariant - luckyPeriod.point.variant.conversions;
    const adjustedBaseVisitors = actualVisitorsBase - luckyPeriod.point.base.visitors;
    const adjustedVariantVisitors = actualVisitorsVariant - luckyPeriod.point.variant.visitors;

    if (adjustedBaseVisitors <= 0 || adjustedVariantVisitors <= 0) {
        return null;
    }

    const { pValue: adjustedPValue } = computeTTest(
        adjustedBaseConversions,
        adjustedBaseVisitors,
        adjustedVariantConversions,
        adjustedVariantVisitors
    );

    const adjustedVariantRate = adjustedVariantVisitors === 0 ? 0 : adjustedVariantConversions / adjustedVariantVisitors;
    const adjustedBaseRate = adjustedBaseVisitors === 0 ? 0 : adjustedBaseConversions / adjustedBaseVisitors;
    
    return {
        adjustedBaseConversions,
        adjustedVariantConversions,
        adjustedBaseVisitors,
        adjustedVariantVisitors,
        adjustedVariantRate,
        adjustedBaseRate,
        adjustedPValue
    };
}

// Helper: Calculate effect rates for original and adjusted experiments
function calculateEffectRates(experiment, adjustedStats, directionFactor) {
    const {
        simulation: {
            actualConversionsBase,
            actualConversionsVariant,
            actualVisitorsBase,
            actualVisitorsVariant
        }
    } = experiment;
    
    const originalVariantRate = actualVisitorsVariant === 0 ? 0 : actualConversionsVariant / actualVisitorsVariant;
    const originalBaseRate = actualVisitorsBase === 0 ? 0 : actualConversionsBase / actualVisitorsBase;
    const originalPositive = directionFactor * (originalVariantRate - originalBaseRate) > 0;
    
    const adjustedPositive = directionFactor * (adjustedStats.adjustedVariantRate - adjustedStats.adjustedBaseRate) > 0;
    
    const effectWithLuckyDay = directionFactor * (originalVariantRate - originalBaseRate);
    const effectWithoutLuckyDay = directionFactor * (adjustedStats.adjustedVariantRate - adjustedStats.adjustedBaseRate);
    
    return {
        originalVariantRate,
        originalBaseRate,
        originalPositive,
        adjustedPositive,
        effectWithLuckyDay,
        effectWithoutLuckyDay
    };
}

// Helper: Calculate share of effect attributable to lucky day
function calculateEffectShare(effectWithLuckyDay, effectWithoutLuckyDay) {
    const MIN_SHARE_THRESHOLD = 0.5;
    
    if (Math.abs(effectWithLuckyDay) === 0) {
        return { share: 0, meetsThreshold: false };
    }
    
    const effectAttributableToLuckyDay = effectWithLuckyDay - effectWithoutLuckyDay;
    const share = Math.abs(effectAttributableToLuckyDay) / Math.abs(effectWithLuckyDay);
    const meetsThreshold = share >= MIN_SHARE_THRESHOLD;
    
    return { share, meetsThreshold, threshold: MIN_SHARE_THRESHOLD };
}

// Helper: Validate if lucky day meets trap criteria
function validateLuckyDayTrap(significant, adjustedSignificant, originalPositive, adjustedPositive) {
    if (significant) {
        // Original was significant: must become non-significant OR significant in opposite direction
        return !adjustedSignificant || (adjustedSignificant && adjustedPositive !== originalPositive);
    } else {
        // Original was NOT significant: must become significant
        return adjustedSignificant;
    }
}

// Helper: Format period label from lucky period
function formatPeriodLabel(luckyPeriod) {
    const { startDay, endDay } = luckyPeriod.point.period;
    return startDay === endDay ? `day ${startDay}` : `days ${startDay}-${endDay}`;
}

// Main function: Detect lucky day trap
// Simply looks for one period where variant's conversion rate is > 2x base's rate (when higher is better)
// or base's conversion rate is > 2x variant's rate (when lower is better)
function detectLuckyDayTrap(experiment, directionFactor, alpha, significant) {
    // Validate input
    if (!experiment || !experiment.simulation || !experiment.simulation.timeline) {
        return null;
    }

    const { timeline: { timePoints } } = experiment.simulation;
    if (!timePoints || timePoints.length === 0) {
        return null;
    }

    // Determine if higher is better (directionFactor = 1) or lower is better (directionFactor = -1)
    const isHigherBetter = directionFactor > 0;

    // Check each period for the 2x ratio requirement
    for (let i = 0; i < timePoints.length; i++) {
        const point = timePoints[i];
        const baseVisitors = point.base.visitors;
        const variantVisitors = point.variant.visitors;
        const baseConversions = point.base.conversions;
        const variantConversions = point.variant.conversions;

        // Skip periods with no visitors
        if (baseVisitors <= 0 || variantVisitors <= 0) {
            continue;
        }

        const baseRate = baseConversions / baseVisitors;
        const variantRate = variantConversions / variantVisitors;

        // Skip periods with no conversions (can't calculate meaningful ratio)
        if (baseRate === 0 && variantRate === 0) {
            continue;
        }

        // Check for 2x ratio requirement
        let isLuckyPeriod = false;
        if (isHigherBetter) {
            // Higher is better: variant rate > 2 * base rate
            if (baseRate > 0 && variantRate >= MAX_RATE_RATIO * baseRate) {
                isLuckyPeriod = true;
            }
        } else {
            // Lower is better: base rate > 2 * variant rate (i.e., variant rate < base rate / 2)
            if (variantRate > 0 && baseRate >= MAX_RATE_RATIO * variantRate) {
                isLuckyPeriod = true;
            }
        }

        if (isLuckyPeriod) {
            // Found a lucky period - calculate additional info for display
            const luckyPeriod = { point, index: i };
            
            // Calculate adjusted experiment statistics (for info only, not used as requirement)
            const adjustedStats = calculateAdjustedExperiment(experiment, luckyPeriod);
            const adjustedSignificant = adjustedStats ? adjustedStats.adjustedPValue < alpha : null;
            
            // Always calculate adjusted rates directly from experiment data
            const {
                simulation: {
                    actualConversionsBase,
                    actualConversionsVariant,
                    actualVisitorsBase,
                    actualVisitorsVariant
                }
            } = experiment;
            
            const adjustedBaseConversions = actualConversionsBase - luckyPeriod.point.base.conversions;
            const adjustedVariantConversions = actualConversionsVariant - luckyPeriod.point.variant.conversions;
            const adjustedBaseVisitors = actualVisitorsBase - luckyPeriod.point.base.visitors;
            const adjustedVariantVisitors = actualVisitorsVariant - luckyPeriod.point.variant.visitors;
            
            const adjustedBaseRate = adjustedBaseVisitors > 0 ? adjustedBaseConversions / adjustedBaseVisitors : 0;
            const adjustedVariantRate = adjustedVariantVisitors > 0 ? adjustedVariantConversions / adjustedVariantVisitors : 0;
            
            // Calculate effect rates and share (for info only, not used as requirement)
            let share = null;
            let adjustedPValue = null;
            let adjustedPositive = null;
            
            if (adjustedStats) {
                adjustedPValue = adjustedStats.adjustedPValue;
                const effectRates = calculateEffectRates(experiment, adjustedStats, directionFactor);
                adjustedPositive = effectRates.adjustedPositive;
                const shareResult = calculateEffectShare(
                    effectRates.effectWithLuckyDay,
                    effectRates.effectWithoutLuckyDay
                );
                share = shareResult.share;
            }
            
            // Calculate effect percentage (uplift) after excluding lucky day
            let adjustedEffectPercentage = 0; // Default to 0 instead of null
            if (isHigherBetter) {
                // Higher is better: calculate uplift as (variantRate - baseRate) / baseRate * 100
                if (adjustedBaseRate > 0) {
                    adjustedEffectPercentage = ((adjustedVariantRate / adjustedBaseRate) - 1) * 100;
                } else if (adjustedVariantRate > 0) {
                    // If base rate is 0 but variant rate is positive, it's infinite improvement
                    adjustedEffectPercentage = Infinity;
                }
                // else: Both rates are 0, keep default of 0
            } else {
                // Lower is better: calculate uplift as (baseRate - variantRate) / variantRate * 100
                if (adjustedVariantRate > 0) {
                    adjustedEffectPercentage = ((adjustedBaseRate / adjustedVariantRate) - 1) * 100;
                } else if (adjustedBaseRate > 0) {
                    // If variant rate is 0 but base rate is positive, it's infinite improvement
                    adjustedEffectPercentage = Infinity;
                }
                // else: Both rates are 0, keep default of 0
            }
            

            const periodLabel = formatPeriodLabel(luckyPeriod);

    return {
                periodIndex: i,
                startDay: point.period.startDay,
                endDay: point.period.endDay,
        share,
                sharePercentage: share ? share * 100 : null,
        periodLabel,
                conversionsBase: baseConversions,
                conversionsVariant: variantConversions,
                visitorsBase: baseVisitors,
                visitorsVariant: variantVisitors,
        adjustedPValue,
        adjustedPositive,
        adjustedSignificant,
                adjustedBaseRate,
                adjustedVariantRate,
                adjustedEffectPercentage,
                baseRate,
                variantRate,
                rateRatio: isHigherBetter 
                    ? (baseRate > 0 ? variantRate / baseRate : null)
                    : (variantRate > 0 ? baseRate / variantRate : null)
            };
        }
    }

    // No lucky period found
    return null;
}

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

function findFirstValidCheckpoint(experiment, correctSampleSize) {
    const {
        simulation: {
            timeline: { timePoints }
        }
    } = experiment;

    // Find first checkpoint where both variants have sufficient sample size AND it's a full week
    for (let i = 0; i < timePoints.length; i++) {
        const point = timePoints[i];
        const { base, variant } = point;

        // Check if both variants have sufficient sample size
        const hasSufficientSample = base.cumulativeVisitors >= correctSampleSize &&
            variant.cumulativeVisitors >= correctSampleSize;

        // Check if it's a full week boundary (endDay is divisible by 7)
        const isFullWeek = point.period.endDay % 7 === 0;

        if (hasSufficientSample && isFullWeek) {
            return point.period.endDay;
        }
    }

    return null; // No valid checkpoint found
}

function filterUnderpoweredDesignData(experiment, correctSampleSize) {
    const {
        simulation: {
            timeline: { currentRuntimeDays, timePoints }
        },
        experiment: { alpha }
    } = experiment;


    // Find first checkpoint where both variants have sufficient sample size AND it's a full week
    let firstValidCheckpoint = null;

    for (let i = 0; i < timePoints.length; i++) {
        const point = timePoints[i];
        const { base, variant } = point;

        // Check if both variants have sufficient sample size
        const hasSufficientSample = base.cumulativeVisitors >= correctSampleSize &&
            variant.cumulativeVisitors >= correctSampleSize;

        // Check if it's a full week boundary (endDay is divisible by 7)
        const isFullWeek = point.period.endDay % 7 === 0;

        if (hasSufficientSample && isFullWeek) {
            firstValidCheckpoint = point.period.endDay;
            console.log('✅ Found first valid checkpoint at day:', firstValidCheckpoint);
            console.log('📊 Sample sizes at checkpoint:', {
                base: base.cumulativeVisitors,
                variant: variant.cumulativeVisitors
            });
            break;
        }
    }

    if (!firstValidCheckpoint) {
        return null;
    }

    // Filter timeline to only include data up to first valid checkpoint
    const filteredTimePoints = timePoints.filter(tp => tp.period.endDay <= firstValidCheckpoint);

    // Get final data at the checkpoint
    const finalPoint = filteredTimePoints[filteredTimePoints.length - 1];
    const { base, variant } = finalPoint;

    // Recompute p-value and CI for filtered data
    const { pValue: filteredP } = computeTTest(
        base.cumulativeConversions, base.cumulativeVisitors,
        variant.cumulativeConversions, variant.cumulativeVisitors
    );
    const filteredDiffCI = computeDifferenceConfidenceInterval(
        base.cumulativeVisitors === 0 ? 0 : base.cumulativeConversions / base.cumulativeVisitors,
        variant.cumulativeVisitors === 0 ? 0 : variant.cumulativeConversions / variant.cumulativeVisitors,
        base.cumulativeVisitors,
        variant.cumulativeVisitors,
        alpha
    );

    // Create filtered experiment object
    const filteredExperiment = {
        ...experiment,
        simulation: {
            ...experiment.simulation,
            actualVisitorsBase: base.cumulativeVisitors,
            actualVisitorsVariant: variant.cumulativeVisitors,
            actualConversionsBase: base.cumulativeConversions,
            actualConversionsVariant: variant.cumulativeConversions,
            pValue: filteredP,
            confidenceIntervalDifference: filteredDiffCI,
            timeline: {
                ...experiment.simulation.timeline,
                timePoints: filteredTimePoints,
                currentRuntimeDays: firstValidCheckpoint
            }
        }
    };

    console.log('📊 Filtered experiment data:', {
        runtime: firstValidCheckpoint,
        baseVisitors: base.cumulativeVisitors,
        variantVisitors: variant.cumulativeVisitors,
        pValue: filteredP
    });

    return filteredExperiment;
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
            beta,
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

    let trustworthy = EXPERIMENT_TRUSTWORTHY.YES;
    let decision = EXPERIMENT_DECISION.KEEP_RUNNING;
    let followUp = EXPERIMENT_FOLLOW_UP.DO_NOTHING;
    let trustworthyReason = '';
    let decisionReason = '';
    let followUpReason = '';

    // Calculate underpowered design data FIRST (needed for overdue check)
    const varianceA = baseConversionRate * (1 - baseConversionRate);
    const varianceB = (baseConversionRate + minimumRelevantEffect) * (1 - (baseConversionRate + minimumRelevantEffect));
    const correctSampleSize = solveSampleSizeTTest(minimumRelevantEffect, 1 - beta, varianceA, varianceB, alpha);
    const sampleSizeDifference = requiredSampleSizePerVariant - correctSampleSize;
    const hasUnderpoweredDesign = requiredSampleSizePerVariant < correctSampleSize;

    // Calculate actual power achieved with the incorrect sample size
    const desiredPower = 1 - beta;
    const actualPower = calculateActualPower(minimumRelevantEffect, requiredSampleSizePerVariant, varianceA, varianceB, alpha);
    const powerDifference = desiredPower - actualPower;
    const actualDataSufficient = actualVisitorsBase >= correctSampleSize && actualVisitorsVariant >= correctSampleSize;

    // FIRST: Check if experiment is overdue and handle it immediately
    // BUT ONLY if it's NOT an underpowered design (overdue logic doesn't apply to underpowered designs)
    const isOverdue = isExperimentOverdue(experiment);

    if (isOverdue && !hasUnderpoweredDesign) {
        const filteredExperiment = filterOverdueExperimentData(experiment);
        const filteredAnalysis = analyzeExperiment(filteredExperiment);

        // Preserve original experiment data for UI display and overdue information
        return {
            ...filteredAnalysis,
            originalExperiment: experiment,
            analysis: {
                ...filteredAnalysis.analysis,
                overdue: {
                    isOverdue: true,
                    originalRuntime: requiredRuntimeDays,
                    actualRuntime: currentRuntimeDays,
                    extraDays: Math.max(0, currentRuntimeDays - requiredRuntimeDays)
                }
            }
        };
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

    var hasLuckyDay = false;
    const luckyDayInfo =  detectLuckyDayTrap(experiment, directionFactor, alpha, significant)

    // Check for Twyman's Law trap: extremely low p-value AND unusually large effect size
    const pValueString = pValue.toFixed(10);
    const suspiciousPValue = pValueString.includes('0.000000') || pValue < 0.000001;
    const absoluteDelta = Math.abs(variantRate - baseRate);
    const largeEffect = absoluteDelta >= 10 * minimumRelevantEffect;
    const hasTwymansLaw = suspiciousPValue && largeEffect;

    // Underpowered design data already calculated above

    const issues = [];
    if (hasSampleRatioMismatch) issues.push('sample ratio mismatch');
    if (hasBaseRateMismatch) issues.push('base rate mismatch');
    if (hasDataLoss) issues.push('data loss');

    const mismatch = hasSampleRatioMismatch ||
        hasBaseRateMismatch ||
        hasDataLoss;

    var summary = ''
    var trustworthyYesReason = 'No issues. Design is correct and execution is consistent with design, data is reliable.';

    if (mismatch) {
        trustworthy = EXPERIMENT_TRUSTWORTHY.NO;
        decision = EXPERIMENT_DECISION.KEEP_BASE;
        followUp = EXPERIMENT_FOLLOW_UP.RERUN;
        decisionReason = 'Unreliable data cannot be interpreted as evidence aginst the null hypothesis.';

        if (hasSampleRatioMismatch) {
            trustworthyReason = `Sample Ratio Mismatch (SRM) detected. Data is unreliable.`;
            followUpReason = 'Identify the source(s) of the SRM and remediate.';
            summary = 'Experiment with Sample Ratio Mismatch (SRM). Unreliable data is no evidence against the null hypothesis. SRM must be fixed and the experiment rerun.';
        }

        if (hasBaseRateMismatch) {
            trustworthyReason = `Observed Base Conversion Rate is very different from the one used to design the experiment. Data is unreliable.`;
            followUpReason = 'Identify the source of Base Conversion Rate Missmatch and remediate.';
            summary = 'Conversion rate in Base is very different from the one used to design the experiment which means there are data collection issues. Conversion rate mismatch must be addressed and the experiment rerun.';
        }

        if (hasDataLoss) {
            trustworthyReason = `Data loss detected. Data is unreliable`;
            followUpReason = 'Identify the source of Data Loss and remediate.';
            summary = 'Experiment with Data Loss. Unreliable data is no evidence against the null hypothesis. Data Loss must be fixed and the experiment rerun.';
        }
    } else if (!finished && (lowSampleSize || !fullWeek)) {
        trustworthy = EXPERIMENT_TRUSTWORTHY.NO;
        followUp = EXPERIMENT_FOLLOW_UP.DO_NOTHING;
        decision = EXPERIMENT_DECISION.KEEP_RUNNING;
        followUpReason = 'None, experiment is not completed yet.';

        if (lowSampleSize) {
            trustworthyReason = `Cannot make trustworthy decisions before achieving the planned sample size (have base=${actualVisitorsBase.toLocaleString()}, variant=${actualVisitorsVariant.toLocaleString()}, need ≥ ${requiredSampleSizePerVariant.toLocaleString()} each).`;
            decisionReason = `Insufficient sample size: current data (${actualVisitorsBase.toLocaleString()}/${actualVisitorsVariant.toLocaleString()}) below required threshold (${requiredSampleSizePerVariant.toLocaleString()} each). Keep running to reach planned sample size.`;
            summary = 'This experiment is not completed yet. Keep the experiment running to reach the planned sample size.';
        } else if (!fullWeek) {
            trustworthyReason = `Experiment reached the planned sample size but we cannot make trustworthy decisions before achieving full-week coverage.`;
            decisionReason = `Insufficient time coverage: reached sample size early but need full-week coverage for reliable inference. Keep running to complete full business cycles.`;
            summary = 'This experiment reached the planned sample size eariler than expecetd, but we cannot make trustworthy decisions before achieving full-week coverage. Keep the experiment running to reach full-week coverage.';
        }
    } else if (finished && (lowSampleSize || !fullWeek)) {
        trustworthy = EXPERIMENT_TRUSTWORTHY.NO;
        decision = EXPERIMENT_DECISION.KEEP_RUNNING;
        followUp = EXPERIMENT_FOLLOW_UP.DO_NOTHING;
        followUpReason = 'None, experiment is not completed yet.';

        if (lowSampleSize) {
            trustworthyReason = `Runtime finished but sample size is lower than planned. Cannot make trustworthy decisions before achieving the planned sample size (have base=${actualVisitorsBase.toLocaleString()}, variant=${actualVisitorsVariant.toLocaleString()}, need ≥ ${requiredSampleSizePerVariant.toLocaleString()} each).`;
            decisionReason = `Runtime completed but insufficient data: current sample (${actualVisitorsBase.toLocaleString()}/${actualVisitorsVariant.toLocaleString()}) below required threshold (${requiredSampleSizePerVariant.toLocaleString()} each). Keep running to reach planned sample size.`;
            summary = 'This experiment runtime finished but sample size is lower than planned. Cannot make trustworthy decisions before achieving the planned sample size. Keep the experiment running to reach the planned sample size.';
        } else if (!fullWeek) {
            trustworthyReason = `Runtime finished and planned sample size is achieved, but we cannot make trustworthy decisions before achieving full-week coverage.`;
            decisionReason = `Runtime completed but insufficient time coverage: reached sample size early but need full-week coverage for reliable inference. Keep running to complete full business cycles.`;
            summary = 'This experiment is progressing faster than expected. It already reached the planned sample size but we cannot make trustworthy decisions before achieving full-week coverage. Keep the experiment running to reach full-week coverage.';
        }
    } else if (!luckyDayInfo && (!significant || !isEffectPositive)) { //finished or not, sample size is sufficient AND full-week coverage is achieved
        trustworthy = EXPERIMENT_TRUSTWORTHY.YES;
        trustworthyReason = trustworthyYesReason;
        decision = EXPERIMENT_DECISION.KEEP_BASE;
        followUp = EXPERIMENT_FOLLOW_UP.ITERATE;

        const [ciLow, ciHigh] = confidenceIntervalDifference;
        const delta = (variantRate - baseRate);
        const directionNote = improvementDirection === IMPROVEMENT_DIRECTION.LOWER ? 'lower is better' : 'higher is better';
        const aligns = isEffectPositive ? 'aligns' : 'does not align';
        
        if (!significant) {
            // Inconclusive: not statistically significant
            decisionReason = `Inconclusive result: p=${pValue.toFixed(4)} (α=${alpha}), no significant difference detected, Δ=${(delta * 100).toFixed(2)}pp, CI[Δ]=[${(ciLow * 100).toFixed(2)}pp, ${(ciHigh * 100).toFixed(2)}pp].`;
            followUpReason = 'Iterate by refining the hypothesis, the treatment and/or the experiment design.';
            summary = 'This experiment is trustworthy and not statistically significant. Iterate by refining the hypothesis, the treatment and/or the experiment design.';
        } else {
            // Conclusive negative: significant but wrong direction
            decisionReason = `Conclusive negative result: p=${pValue.toFixed(4)} (α=${alpha}), variant is significantly worse (${directionNote}), Δ=${(delta * 100).toFixed(2)}pp, CI[Δ]=[${(ciLow * 100).toFixed(2)}pp, ${(ciHigh * 100).toFixed(2)}pp].`;
            followUpReason = 'Variant performs worse than base. Investigate why and iterate on the hypothesis.';
            summary = 'This Experiment is trustworthy and statistically significant in favor of Base.  Iterate by refining the hypothesis, the treatment and/or the experiment design.';
        }
    } else if (!luckyDayInfo) {
        // No lucky day, significant and positive
        // Check for Twyman's Law trap: extremely low p-value AND unusually large effect size
        if (hasTwymansLaw) {
            trustworthy = EXPERIMENT_TRUSTWORTHY.NO;
            trustworthyReason = `Twyman's Law detected: p-value is suspiciously low (p=${pValue.toFixed(10)}). Results that are "too good to be true" often indicate data quality issues, p-hacking, or other problems that make the experiment unreliable.`;
            decision = EXPERIMENT_DECISION.KEEP_VARIANT;
            decisionReason = 'Despite the suspicious p-value, the effect direction aligns with business goals. Proceed with caution and validate thoroughly.';
            followUp = EXPERIMENT_FOLLOW_UP.VALIDATE;
            followUpReason = 'Validate the results through additional testing, data quality checks, and monitoring. The suspiciously low p-value suggests potential issues that need investigation.';
            summary = "This experiment shows an extremely low p-value and very large effect (Twyman's Law). Proceed with variant cautiously and validate thoroughly before rollout.";
        } else {
            trustworthy = EXPERIMENT_TRUSTWORTHY.YES;
            decision = EXPERIMENT_DECISION.KEEP_VARIANT;
            followUp = EXPERIMENT_FOLLOW_UP.CELEBRATE;

            trustworthyReason = trustworthyYesReason;
            followUpReason = 'Success! Celebrate by planning a new experiment!';
            summary = 'This Experiment is trustworthy and statistically significant in favor of Variant. Ship it and celebrate by planning a new experiment!';

            const [ciLow, ciHigh] = confidenceIntervalDifference;
            const delta = (variantRate - baseRate);
            if (improvementDirection === IMPROVEMENT_DIRECTION.LOWER) {
                decisionReason = `Variant is significantly lower (lower is better): p=${pValue.toFixed(4)} (α=${alpha}), Δ=${(delta * 100).toFixed(2)}pp, CI[Δ]=[${(ciLow * 100).toFixed(2)}pp, ${(ciHigh * 100).toFixed(2)}pp].`;
            } else {
                decisionReason = `Variant is significantly higher: p=${pValue.toFixed(4)} (α=${alpha}), Δ=${(delta * 100).toFixed(2)}pp, CI[Δ]=[${(ciLow * 100).toFixed(2)}pp, ${(ciHigh * 100).toFixed(2)}pp].`;
            }
        }
    } else {
        hasLuckyDay = true
        // Lucky day detected: Generalized lucky-day concentration: experiment becomes untrustworthy
        trustworthy = EXPERIMENT_TRUSTWORTHY.NO;

        const dayLabel = luckyDayInfo.periodLabel || (
            luckyDayInfo.startDay === luckyDayInfo.endDay
                ? `day ${luckyDayInfo.startDay}`
                : `days ${luckyDayInfo.startDay}-${luckyDayInfo.endDay}`
        );
        const sharePct = (luckyDayInfo.sharePercentage || (luckyDayInfo.share * 100)).toFixed(1);
        const adjustedPVal = typeof luckyDayInfo.adjustedPValue === 'number' ? luckyDayInfo.adjustedPValue.toFixed(4) : 'n/a';

        if (significant && isEffectPositive) {
            // Conclusive positive in the right direction: proceed but require validation
            decision = EXPERIMENT_DECISION.KEEP_VARIANT;
            followUp = EXPERIMENT_FOLLOW_UP.VALIDATE;
            trustworthyReason = `${dayLabel} is a lucky day. Most of the total effect comes from ${dayLabel}. Total effect after excluding it: ${luckyDayInfo.adjustedEffectPercentage !== null && luckyDayInfo.adjustedEffectPercentage !== undefined ? luckyDayInfo.adjustedEffectPercentage.toFixed(2) + '%' : 'n/a'}, p-value: ${adjustedPVal} (${luckyDayInfo.adjustedSignificant ? 'significant' : 'not significant'}).`;
            decisionReason = `Overall result is significant (p=${pValue.toFixed(4)} < α=${alpha}), but excluding ${dayLabel} yields p=${adjustedPVal}. Keep the variant while treating the uplift as provisional.`;
            followUpReason = 'Validate with a follow-up run or close monitoring to confirm the lift persists beyond the lucky day.';
            summary = 'This experiment shows evidence in favor of Variant but most of the total effect comes from a lucky day. Validate with a follow-up run.';
        } else {
            // Any other case (inconclusive or negative): rerun to confirm, do not ship
            decision = EXPERIMENT_DECISION.KEEP_BASE;
            followUp = EXPERIMENT_FOLLOW_UP.ITERATE;
            trustworthyReason = `Total effect largely influenced by ${dayLabel}. Total effect after excluding it: ${luckyDayInfo.adjustedEffectPercentage !== null && luckyDayInfo.adjustedEffectPercentage !== undefined ? luckyDayInfo.adjustedEffectPercentage.toFixed(2) + '%' : 'n/a'}, p-value: ${adjustedPVal} (${luckyDayInfo.adjustedSignificant ? 'significant' : 'not significant'}).`;
            decisionReason = `Even with a lucky day, the data shows no evidence in favor of Variant.`;
            followUpReason = 'Iterate by refining the hypothesis, the treatment and/or the experiment design.';
            summary = 'This experiment shows no evidence in favor of Variant, even with a lucky day. Investigate the cause of the lucky day and iterate by refining the hypothesis, the treatment and/or the experiment design.';
        }
    }

    // UNDERPOWERED DESIGN CHECK - MUST BE LAST (highest precedence)
    // This check overrides decisions based on current decision state only
    if (hasUnderpoweredDesign) {
        console.log('🔍 Underpowered design detected - applying precedence logic:');
        console.log('Current decision before underpowered check:', decision);
        console.log('Actual data sufficient:', actualDataSufficient);
        console.log('Is this already a filtered experiment?', !!experiment.originalExperiment);

        // Scenario 1: Design underpowered + Actual data insufficient
        if (!actualDataSufficient) {
            if (followUp !== EXPERIMENT_FOLLOW_UP.RERUN) {
                trustworthy = EXPERIMENT_TRUSTWORTHY.NO;
                trustworthyReason = `Data is insufficient to reach the desired power of ${(desiredPower * 100).toFixed(0)}% (power at this sample size is ${(actualPower * 100).toFixed(0)}%). Design error: required ${requiredSampleSizePerVariant.toLocaleString()} but need ${correctSampleSize.toLocaleString()} per variant.`;
                decision = EXPERIMENT_DECISION.KEEP_RUNNING;
                decisionReason = `Underpowered design: current sample (${actualVisitorsBase.toLocaleString()}/${actualVisitorsVariant.toLocaleString()}) insufficient for ${(desiredPower * 100).toFixed(0)}% power (only ${(actualPower * 100).toFixed(0)}% power). Keep running to reach correct sample size (${correctSampleSize.toLocaleString()} each) at full-week boundaries.`;
                followUp = EXPERIMENT_FOLLOW_UP.DO_NOTHING;
                followUpReason = 'Continue collecting data; avoid peeking-driven decisions before reaching required sample and full cycles.';
                console.log('✅ Applied underpowered logic: Need more data');
                summary = 'This experiment was designed underpowered and current data is insufficient. Keep running until reaching the correct sample size at full-week boundaries.';
            } else {
                console.log('⚠️ RERUN follow-up takes precedence over underpowered design');
            }
        }
        // Scenario 2: Design underpowered + Actual data sufficient
        else if (actualDataSufficient) {
            // Find the first valid checkpoint
            const firstValidCheckpoint = findFirstValidCheckpoint(experiment, correctSampleSize);

            if (firstValidCheckpoint === null) {
                // No valid checkpoint found - need more data
                trustworthy = EXPERIMENT_TRUSTWORTHY.NO;
                trustworthyReason = `Design was underpowered but no valid checkpoint found. Need more data to reach ${correctSampleSize.toLocaleString()} per variant at a full week boundary.`;
                decision = EXPERIMENT_DECISION.KEEP_RUNNING;
                decisionReason = `Underpowered design with no valid checkpoint: need ${correctSampleSize.toLocaleString()} per variant at full-week boundary but none found. Keep running to reach sufficient sample size at a full-week boundary.`;
                followUp = EXPERIMENT_FOLLOW_UP.DO_NOTHING;
                followUpReason = 'Continue collecting data; avoid peeking-driven decisions before reaching required sample and full cycles.';
                console.log('❌ No valid checkpoint found - need more data');
                summary = 'This experiment was designed underpowered and lacks a valid full-week checkpoint at sufficient sample. Keep running to reach the correct sample size at a full-week boundary.';
            } else if (firstValidCheckpoint === currentRuntimeDays) {
                // First valid checkpoint is current date - we're already at the right point
                console.log('✅ Already at first valid checkpoint - no filtering needed');
                // Just add a note about the design error being overcome
                if (trustworthyReason === 'Data quality checks passed.') {
                    trustworthyReason = 'Data quality checks passed. Note: Original design was underpowered but sufficient data was collected.';
                }
                // Keep the existing branch summary if already set by earlier logic
            } else {
                // First valid checkpoint is in the past - filter data and reanalyze
                console.log(`🔍 First valid checkpoint is at day ${firstValidCheckpoint} (current: ${currentRuntimeDays}) - filtering data`);
                const filteredExperiment = filterUnderpoweredDesignData(experiment, correctSampleSize);
                const filteredAnalysis = analyzeExperiment(filteredExperiment);

                // Preserve original experiment data for UI display
                return {
                    ...filteredAnalysis,
                    originalExperiment: experiment,
                    analysis: {
                        ...filteredAnalysis.analysis,
                        underpoweredDesignFiltered: {
                            originalRuntime: currentRuntimeDays,
                            filteredRuntime: filteredExperiment.simulation.timeline.currentRuntimeDays,
                            extraDays: Math.max(0, currentRuntimeDays - filteredExperiment.simulation.timeline.currentRuntimeDays),
                            designErrorOvercome: true
                        }
                    }
                };
            }
        }
    }

    return {
        decision: {
            trustworthy: trustworthy,
            trustworthyReason: trustworthyReason,
            decision: decision,
            decisionReason: decisionReason,
            followUp: followUp,
            followUpReason: followUpReason,
            summary: summary
        },
        analysis: {
            hasSignificantRatioMismatch: hasSampleRatioMismatch,
            hasBaseRateMismatch: hasBaseRateMismatch,
            hasTrafficMismatch: false,
            hasInsufficientSampleSize: lowSampleSize,
            hasDataLoss: hasDataLoss,
            dataLossIndex: dataLossIndex,
            hasTwymansLaw: hasTwymansLaw,
            hasLuckyDayTrap: !!luckyDayInfo,
            hasUnderpoweredDesign: hasUnderpoweredDesign,
            underpoweredDesign: {
                requiredSampleSize: requiredSampleSizePerVariant,
                correctSampleSize: correctSampleSize,
                sampleSizeDifference: sampleSizeDifference,
                percentageUnderpowered: Math.round((Math.abs(sampleSizeDifference) / correctSampleSize) * 100),
                desiredPower: desiredPower,
                actualPower: actualPower,
                powerDifference: powerDifference
            },
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
            },
            overdue: {
                isOverdue: overdue,
                originalRuntime: requiredRuntimeDays,
                actualRuntime: currentRuntimeDays,
                extraDays: Math.max(0, currentRuntimeDays - requiredRuntimeDays)
            },
            luckyDayTrap: hasLuckyDay ? {
                periodIndex: luckyDayInfo.periodIndex,
                startDay: luckyDayInfo.startDay,
                endDay: luckyDayInfo.endDay,
                share: luckyDayInfo.share,
                sharePercentage: luckyDayInfo.sharePercentage,
                periodLabel: luckyDayInfo.periodLabel,
                adjustedPValue: luckyDayInfo.adjustedPValue,
                adjustedSignificant: luckyDayInfo.adjustedSignificant,
                adjustedPositive: luckyDayInfo.adjustedPositive,
                adjustedEffectPercentage: luckyDayInfo.adjustedEffectPercentage,
                conversionsDifference: luckyDayInfo.conversionsDifference,
                conversionsBase: luckyDayInfo.conversionsBase,
                conversionsVariant: luckyDayInfo.conversionsVariant
            } : null
        }
    };
}

window.generateABTestChallenge = generateABTestChallenge;
window.analyzeExperiment = analyzeExperiment;
window.IMPROVEMENT_DIRECTION = IMPROVEMENT_DIRECTION;
