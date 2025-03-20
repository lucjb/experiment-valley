class ProgressTracker {
    constructor() {
        this.storage = window.localStorage;
        this.initializeProgress();
    }

    initializeProgress() {
        if (!this.storage.getItem('abtest_progress')) {
            const initialProgress = {
                level: 1,
                score: 0,
                streak: 0,
                totalAttempts: 0,
                correctAttempts: 0,
                history: []
            };
            this.storage.setItem('abtest_progress', JSON.stringify(initialProgress));
        }
    }

    getProgress() {
        return JSON.parse(this.storage.getItem('abtest_progress'));
    }

    updateProgress(correct) {
        const progress = this.getProgress();
        progress.totalAttempts++;
        
        if (correct) {
            progress.score += (progress.level * 10);
            progress.streak++;
            progress.correctAttempts++;
            
            // Level up every 5 correct answers
            if (progress.correctAttempts % 5 === 0 && progress.level < 5) {
                progress.level++;
            }
        } else {
            progress.streak = 0;
        }

        progress.history.push({
            timestamp: new Date().toISOString(),
            correct,
            level: progress.level
        });

        this.storage.setItem('abtest_progress', JSON.stringify(progress));
        this.updateUI(progress);
    }

    updateUI(progress) {
        document.getElementById('current-level').textContent = progress.level;
        document.getElementById('score').textContent = progress.score;
        document.getElementById('streak').textContent = progress.streak;
        document.getElementById('accuracy').textContent = 
            `${((progress.correctAttempts / progress.totalAttempts) * 100).toFixed(1)}%`;
    }

    getCurrentLevel() {
        return this.getProgress().level;
    }
}

// Initialize progress tracker
const progressTracker = new ProgressTracker();
