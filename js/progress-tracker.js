class ProgressTracker {
    constructor() {
        this.storage = window.localStorage;
        this.initializeProgress();
    }

    initializeProgress() {
        if (!this.storage.getItem('abtest_progress')) {
            const initialProgress = {
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
            progress.correctAttempts++;
        }

        progress.history.push({
            timestamp: new Date().toISOString(),
            correct
        });

        this.storage.setItem('abtest_progress', JSON.stringify(progress));
        this.updateUI(progress);
    }

    updateUI(progress) {
        document.getElementById('accuracy').textContent = 
            `${((progress.correctAttempts / progress.totalAttempts) * 100).toFixed(1)}%`;
    }
}

// Initialize progress tracker
const progressTracker = new ProgressTracker();
