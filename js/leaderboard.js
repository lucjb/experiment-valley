/* global Backend */

(function () {
    async function fetchAllData() {
        const client = Backend.getClient();
        // Pull minimal needed data from session_summaries
        const [profiles, summaries] = await Promise.all([
            client.from('profiles').select('id, display_name'),
            client.from('session_summaries').select('profile_id, max_round_reached, total_impact_cpd, accuracy_pct, opponent_name, opponent_impact_cpd')
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
                bestAccuracy: 0,
                maxRound: 0,
                maxImpact: 0,
                // For max round leaderboard: track the session with highest round
                maxRoundSession: null,
                // For opponent tracking: track opponent info from best impact session
                opponentName: null,
                opponentImpact: 0
            });
        });

        // Process session summaries to get best metrics per profile
        summaries.forEach(s => {
            const agg = byProfile.get(s.profile_id);
            if (!agg) return;
            
            const round = Number(s.max_round_reached) || 0;
            const accuracy = Number(s.accuracy_pct) || 0;
            const impact = Number(s.total_impact_cpd) || 0;
            const opponentImpact = Number(s.opponent_impact_cpd) || 0;
            
            // Best accuracy across all sessions
            agg.bestAccuracy = Math.max(agg.bestAccuracy, accuracy);
            
            // Max round reached across all sessions
            if (round > agg.maxRound) {
                agg.maxRound = round;
                agg.maxRoundSession = { round, accuracy };
            }
            
            // Max impact across all sessions - also track opponent info from this session
            if (impact > agg.maxImpact) {
                agg.maxImpact = impact;
                agg.opponentName = s.opponent_name || 'Unknown';
                agg.opponentImpact = opponentImpact;
            }
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
            .map(r => ({ 
                name: r.displayName, 
                impact: r.maxImpact,
                opponentName: r.opponentName,
                opponentImpact: r.opponentImpact
            }))
            .sort((a, b) => b.impact - a.impact);

        return { roundBoard, impactBoard };
    }

    function renderList(containerId, items, formatter) {
        const list = document.getElementById(containerId);
        if (!list) return;
        list.innerHTML = '';
        items.slice(0, 20).forEach((it, index) => {
            const entry = document.createElement('div');
            entry.className = 'flex items-center justify-between px-4 py-2 hover:bg-gray-700/30 transition-colors';
            entry.style.backgroundColor = 'transparent';
            
            const rank = index + 1;
            const rankBadge = document.createElement('div');
            
            if (rank <= 3) {
                rankBadge.className = 'flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-green-500 text-white shadow-md';
                rankBadge.style.boxShadow = '0 0 8px rgba(34, 197, 94, 0.4)';
            } else {
                rankBadge.className = 'flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-gray-600 text-gray-200';
            }
            
            rankBadge.textContent = rank;
            
            const content = document.createElement('div');
            content.className = 'flex-1 ml-1';
            content.innerHTML = formatter(it);
            
            entry.appendChild(rankBadge);
            entry.appendChild(content);
            list.appendChild(entry);
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
            renderList('round-list', roundBoard, (r) => `
                <div class="flex items-center justify-between w-full">
                    <div class="text-white font-semibold text-lg">${r.name}</div>
                    <div class="text-right">
                        <div class="text-green-400 font-bold text-lg">Round ${r.maxRound}</div>
                        <div class="text-gray-300 text-sm">${r.accuracy}% accuracy</div>
                    </div>
                </div>
            `);
            renderList('impact-list', impactBoard, (r) => {
                // Determine if player scored higher than opponent
                const playerWon = r.impact > r.opponentImpact;
                const impactColor = playerWon ? 'text-green-400' : 'text-red-400';
                
                return `
                    <div class="flex items-center justify-between w-full">
                        <div class="text-white font-semibold text-lg">${r.name}</div>
                        <div class="text-right">
                            <div class="${impactColor} font-bold text-xl">${r.impact} cpd</div>
                            <div class="text-gray-300 text-sm">vs ${r.opponentName || 'Unknown'}: ${r.opponentImpact} cpd</div>
                        </div>
                    </div>
                `;
            });
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