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
        const nameCounts = new Map();
        
        // Count occurrences of each display name to handle collisions
        profiles.forEach(p => {
            const count = nameCounts.get(p.display_name) || 0;
            nameCounts.set(p.display_name, count + 1);
        });
        
        profiles.forEach(p => {
            const count = nameCounts.get(p.display_name);
            const displayName = count > 1 ? `${p.display_name} #${p.id.slice(-4)}` : p.display_name;
            
            byProfile.set(p.id, {
                displayName: displayName,
                originalName: p.display_name,
                profileId: p.id,
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
                originalName: r.originalName,
                profileId: r.profileId,
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
                originalName: r.originalName,
                profileId: r.profileId,
                impact: r.maxImpact,
                opponentName: r.opponentName,
                opponentImpact: r.opponentImpact
            }))
            .sort((a, b) => b.impact - a.impact);

        return { roundBoard, impactBoard };
    }

    function renderList(containerId, items, formatter, highlightUser = null) {
        const list = document.getElementById(containerId);
        if (!list) return;
        list.innerHTML = '';
        items.forEach((it, index) => {
            const entry = document.createElement('div');
            const isHighlighted = highlightUser && it.name === highlightUser;
            
            // Add data attributes for scrolling
            entry.setAttribute('data-user-name', it.name);
            entry.setAttribute('data-user-id', it.profileId || '');
            
            if (isHighlighted) {
                entry.className = 'flex items-center justify-between px-4 py-2 hover:bg-gray-700/30 transition-colors';
                entry.style.backgroundColor = 'rgba(255, 255, 0, 0.2)';
                entry.style.border = '2px solid #fbbf24';
                entry.style.borderRadius = '8px';
                entry.style.boxShadow = '0 0 20px rgba(251, 191, 36, 0.5)';
            } else {
                entry.className = 'flex items-center justify-between px-4 py-2 hover:bg-gray-700/30 transition-colors';
                entry.style.backgroundColor = 'transparent';
            }
            
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

    function getUrlParameter(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }

    function scrollToUser(userName, listId) {
        const list = document.getElementById(listId);
        if (!list) return;
        
        const entries = list.querySelectorAll('[data-user-name]');
        entries.forEach(entry => {
            const entryName = entry.getAttribute('data-user-name');
            if (entryName === userName || entryName === `${userName} #${entry.getAttribute('data-user-id')?.slice(-4)}`) {
                entry.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            }
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
            
            // Get user parameter from URL
            const highlightUser = getUrlParameter('user');
            
            renderList('round-list', roundBoard, (r) => `
                <div class="flex items-center justify-between w-full">
                    <div class="text-white font-semibold text-lg">${r.name}</div>
                    <div class="text-right">
                        <div class="text-green-400 font-bold text-lg">Round ${r.maxRound}</div>
                        <div class="text-gray-300 text-sm">${r.accuracy}% accuracy</div>
                    </div>
                </div>
            `, highlightUser);
            
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
            }, highlightUser);
            
            // Auto-scroll to user if specified
            if (highlightUser) {
                setTimeout(() => {
                    scrollToUser(highlightUser, 'round-list');
                    scrollToUser(highlightUser, 'impact-list');
                }, 500); // Small delay to ensure rendering is complete
            }
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