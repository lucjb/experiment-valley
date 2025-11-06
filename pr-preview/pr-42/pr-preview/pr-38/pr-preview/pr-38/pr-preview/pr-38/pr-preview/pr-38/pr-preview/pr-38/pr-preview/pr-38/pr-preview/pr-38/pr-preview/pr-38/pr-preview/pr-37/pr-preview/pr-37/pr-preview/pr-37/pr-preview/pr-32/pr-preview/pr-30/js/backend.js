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

        // 2) Check if there are existing profiles with this name
        try {
            const { data: existingProfiles } = await supabase
                .from('profiles')
                .select('id, display_name, created_at')
                .eq('display_name', displayName)
                .order('created_at', { ascending: true });
            
            if (existingProfiles && existingProfiles.length > 0) {
                // Check if this is a returning user by looking for their specific profile
                const sessionKey = `abgym_session_${displayName}`;
                const sessionId = localStorage.getItem(sessionKey);
                
                if (sessionId) {
                    const { data: existing } = await supabase
                        .from('profiles')
                        .select('id, display_name')
                        .eq('id', sessionId)
                        .maybeSingle();
                    if (existing && existing.id) {
                        profileId = existing.id;
                        localStorage.setItem(key, JSON.stringify(existing));
                        return profileId;
                    }
                }
                
                // If we get here, it's a new user with an existing name
                // We'll create a new profile but the leaderboard will handle the collision display
                console.log(`Warning: Name "${displayName}" already exists. Creating new profile.`);
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
        
        // Store session-specific profile ID for future reference
        const sessionKey = `abgym_session_${displayName}`;
        localStorage.setItem(sessionKey, data.id);
        
        return profileId;
    }

    async function checkNameCollision(displayName) {
        try {
            // First check if current user already has a profile with this name
            const key = 'abgym_profile';
            const cached = JSON.parse(localStorage.getItem(key) || 'null');
            if (cached && cached.display_name === displayName && cached.id) {
                // Current user already has this name, no collision
                return false;
            }
            
            const { data: existingProfiles } = await supabase
                .from('profiles')
                .select('id, display_name, created_at')
                .eq('display_name', displayName)
                .order('created_at', { ascending: true });
            
            return existingProfiles && existingProfiles.length > 0;
        } catch (error) {
            console.error('Error checking name collision:', error);
            return false;
        }
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
                accuracy_pct: data.accuracyPct || 0,
                opponent_name: data.opponentName || null,
                opponent_impact_cpd: data.opponentImpactCpd || 0
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
        getProfileId: () => profileId,
        startSession,
        endSession,
        upsertSessionSummary,
        logEvent,
        checkNameCollision
    };
})();


