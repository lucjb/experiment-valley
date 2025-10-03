// Lightweight Supabase client wrapper for this app
// Responsibilities:
// - Initialize supabase-js client
// - Manage profile caching (display_name → profile_id)
// - Start/end sessions
// - Submit scores
// - Fetch leaderboard view
// - Emit detailed session events

/* global window, localStorage, navigator */

const Backend = (() => {
    let supabase = null;
    let profileId = null;
    let sessionId = null;
    let initialized = false;

    function init(config) {
        const { url, anonKey } = config || {};
        if (!url || !anonKey) {
            throw new Error('Backend.init requires { url, anonKey }');
        }
        if (!window.supabase || !window.supabase.createClient) {
            throw new Error('Supabase SDK not loaded. Include @supabase/supabase-js before backend.js');
        }
        supabase = window.supabase.createClient(url, anonKey);
        initialized = true;
        try {
            window.dispatchEvent(new CustomEvent('backend:ready'));
        } catch (_) {}
    }

    async function ensureProfile(displayName) {
        const key = 'abgym_profile';
        // 1) Try cached profile id, but verify it still exists (DB may have been cleaned)
        try {
            const cached = JSON.parse(localStorage.getItem(key) || 'null');
            if (cached && cached.display_name === displayName && cached.id) {
                const { data: existing } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('id', cached.id)
                    .maybeSingle();
                if (existing && existing.id) {
                    profileId = existing.id;
                    return profileId;
                }
            }
        } catch (_) { /* ignore */ }

        // 2) Try to find an existing profile by display_name (avoid duplicates after cache loss)
        try {
            const { data: byName } = await supabase
                .from('profiles')
                .select('id, display_name')
                .eq('display_name', displayName)
                .limit(1)
                .maybeSingle();
            if (byName && byName.id) {
                profileId = byName.id;
                localStorage.setItem(key, JSON.stringify(byName));
                return profileId;
            }
        } catch (_) { /* ignore */ }

        // 3) Create a new profile
        const { data, error } = await supabase
            .from('profiles')
            .insert({ display_name: displayName })
            .select('id, display_name')
            .single();
        if (error) throw error;
        profileId = data.id;
        localStorage.setItem(key, JSON.stringify(data));
        return profileId;
    }

    async function startSession(params) {
        if (!supabase) throw new Error('Backend not initialized');
        const { displayName, meta } = params || {};
        if (!displayName) throw new Error('startSession requires displayName');
        await ensureProfile(displayName);
        const { data, error } = await supabase
            .from('sessions')
            .insert({
                profile_id: profileId,
                user_agent: navigator.userAgent,
                meta: meta || {}
            })
            .select('id')
            .single();
        if (error) throw error;
        sessionId = data.id;
        return sessionId;
    }

    async function endSession() {
        if (!supabase || !sessionId) return;
        await supabase
            .from('sessions')
            .update({ ended_at: new Date().toISOString() })
            .eq('id', sessionId);
        sessionId = null;
    }


    async function upsertSessionSummary(data) {
        if (!supabase || !sessionId || !profileId) return;
        const { error } = await supabase
            .from('session_summaries')
            .upsert({
                session_id: sessionId,
                profile_id: profileId,
                max_round_reached: data.maxRound || 1,
                total_impact_cpd: data.impactCpd || 0,
                accuracy_pct: data.accuracyPct || 0
            }, {
                onConflict: 'session_id'
            });
        if (error) throw error;
    }


    async function logEvent(event) {
        if (!supabase) throw new Error('Backend not initialized');
        if (!sessionId || !profileId) return; // only after session starts
        const {
            eventType,
            roundNumber = null,
            experimentNumber = null,
            scoreDelta = null,
            payload = null
        } = event || {};
        if (!eventType) throw new Error('logEvent requires eventType');

        const { error } = await supabase
            .from('session_events')
            .insert({
                session_id: sessionId,
                profile_id: profileId,
                event_type: eventType,
                round_number: roundNumber,
                experiment_number: experimentNumber,
                score_delta: scoreDelta,
                payload
            });
        if (error) throw error;
    }

    return {
        init,
        isInitialized: () => initialized,
        getClient: () => supabase,
        startSession,
        endSession,
        upsertSessionSummary,
        logEvent
    };
})();


