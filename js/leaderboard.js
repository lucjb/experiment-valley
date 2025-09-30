/* global Backend */

(function () {
    async function fetchAllData() {
        const client = Backend.getClient();
        // Pull minimal needed data from session_summaries
        const [profiles, summaries] = await Promise.all([
            client.from('profiles').select('id, display_name'),
            client.from('session_summaries').select('profile_id, current_score, max_round_reached, total_impact_cpd, accuracy_pct')
        ]);

        if (profiles.error) throw profiles.error;
        if (summaries.error) throw summaries.error;
        return { profiles: profiles.data || [], summaries: summaries.data || [] };
    }

    function aggregateLeaderboards({ profiles, summaries }) {
        const byProfile = new Map();
        profiles.forEach(p => {
            byProfile.set(p.id, {
                displayName: p.display_name,
                bestScore: 0,
                bestAccuracy: 0,
                maxRound: 0,
                maxImpact: 0,
                // For max round leaderboard: track the session with highest round
                maxRoundSession: null
            });
        });

        // Process session summaries to get best metrics per profile
        summaries.forEach(s => {
            const agg = byProfile.get(s.profile_id);
            if (!agg) return;
            
            const round = Number(s.max_round_reached) || 0;
            const accuracy = Number(s.accuracy_pct) || 0;
            const impact = Number(s.total_impact_cpd) || 0;
            const score = Number(s.current_score) || 0;
            
            // Best score across all sessions
            agg.bestScore = Math.max(agg.bestScore, score);
            
            // Best accuracy across all sessions
            agg.bestAccuracy = Math.max(agg.bestAccuracy, accuracy);
            
            // Max round reached across all sessions
            if (round > agg.maxRound) {
                agg.maxRound = round;
                agg.maxRoundSession = { round, accuracy };
            }
            
            // Max impact across all sessions
            agg.maxImpact = Math.max(agg.maxImpact, impact);
        });

        const rows = Array.from(byProfile.values());
        
        const roundBoard = rows
            .map(r => ({ 
                name: r.displayName, 
                maxRound: r.maxRound, 
                accuracy: r.maxRoundSession ? r.maxRoundSession.accuracy : 0 
            }))
            .sort((a, b) => {
                // Primary sort by max round, secondary by accuracy for ties
                if (b.maxRound !== a.maxRound) return b.maxRound - a.maxRound;
                return b.accuracy - a.accuracy;
            });

        const impactBoard = rows
            .map(r => ({ name: r.displayName, impact: r.maxImpact }))
            .sort((a, b) => b.impact - a.impact);

        return { roundBoard, impactBoard };
    }

    function renderList(containerId, items, formatter) {
        const list = document.getElementById(containerId);
        if (!list) return;
        list.innerHTML = '';
        items.slice(0, 20).forEach((it) => {
            const li = document.createElement('li');
            li.textContent = formatter(it);
            list.appendChild(li);
        });
    }

    async function init() {
        // Wait for backend readiness if needed
        const ensureReady = () => (typeof Backend !== 'undefined' && Backend.isInitialized && Backend.isInitialized());
        if (!ensureReady()) {
            await new Promise(resolve => {
                window.addEventListener('backend:ready', resolve, { once: true });
            });
        }

        try {
            const data = await fetchAllData();
            const { roundBoard, impactBoard } = aggregateLeaderboards(data);
            renderList('round-list', roundBoard, (r) => `${r.name} — Round ${r.maxRound} (${r.accuracy}%)`);
            renderList('impact-list', impactBoard, (r) => `${r.name} — ${r.impact} cpd`);
        } catch (e) {
            console.error('Failed to load leaderboards', e);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();