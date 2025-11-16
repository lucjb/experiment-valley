const test = require('node:test');
const assert = require('node:assert/strict');

// Provide globals expected by challenge-generator
if (!global.window) {
    global.window = {};
}

if (!global.jStat) {
    global.jStat = {
        beta: { sample: () => 0 },
        normal: { sample: () => 0, inv: () => 0 },
        studentt: { cdf: () => 0 },
        chisquare: { cdf: () => 0 }
    };
}

const {
    applyStoppedStatusLogic,
    EXPERIMENT_DECISION,
    EXPERIMENT_STATUS,
    EXPERIMENT_TRUSTWORTHY,
    DEPLOYED_VARIANT
} = require('../../js/challenge-generator.js');

function createOutcome({
    trustworthy = EXPERIMENT_TRUSTWORTHY.YES,
    decision = EXPERIMENT_DECISION.KEEP_BASE,
    decisionReason = 'Base looks safest.'
} = {}) {
    return {
        trustworthy,
        decision,
        decisionReason,
        followUp: 'ITERATE',
        followUpReason: 'Try again',
        summary: 'Summary text'
    };
}

function stoppedStatus(variant) {
    return {
        type: EXPERIMENT_STATUS.STOPPED,
        deployedVariant: variant
    };
}

test('running experiments keep original analysis outcome', () => {
    const outcome = createOutcome();
    const result = applyStoppedStatusLogic(outcome, { type: EXPERIMENT_STATUS.RUNNING });
    assert.strictEqual(result, outcome);
});

test('trustworthy stopped experiments append context when deployment matches', () => {
    const outcome = createOutcome({ decision: EXPERIMENT_DECISION.KEEP_BASE });
    const result = applyStoppedStatusLogic(outcome, stoppedStatus(DEPLOYED_VARIANT.BASE));

    assert.strictEqual(result.decision, EXPERIMENT_DECISION.KEEP_BASE);
    assert.match(result.decisionReason, /Experiment is stopped/);
});

test('trustworthy stopped experiments recommend switching when deployment mismatches', () => {
    const outcome = createOutcome({ decision: EXPERIMENT_DECISION.KEEP_VARIANT });
    const result = applyStoppedStatusLogic(outcome, stoppedStatus(DEPLOYED_VARIANT.BASE));

    assert.strictEqual(result.decision, EXPERIMENT_DECISION.KEEP_VARIANT);
    assert.match(result.decisionReason, /Switch traffic to Variant/);
});

test('untrustworthy stopped experiments reset when deployed variant disagrees', () => {
    const outcome = createOutcome({
        trustworthy: EXPERIMENT_TRUSTWORTHY.NO,
        decision: EXPERIMENT_DECISION.KEEP_VARIANT
    });
    const result = applyStoppedStatusLogic(outcome, stoppedStatus(DEPLOYED_VARIANT.BASE));

    assert.strictEqual(result.decision, EXPERIMENT_DECISION.RESET_EXPERIMENT);
    assert.match(result.decisionReason, /Restart the experiment/);
});

test('stopped experiments without recommended variant default to reset', () => {
    const outcome = createOutcome({ decision: EXPERIMENT_DECISION.KEEP_RUNNING });
    const result = applyStoppedStatusLogic(outcome, stoppedStatus(DEPLOYED_VARIANT.VARIANT));

    assert.strictEqual(result.decision, EXPERIMENT_DECISION.RESET_EXPERIMENT);
});
