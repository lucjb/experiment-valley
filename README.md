# Experiment Valley

An interactive educational platform for learning A/B testing and statistical analysis through hands-on practice. Experiment Valley helps you understand statistical principles, experimental design, and data-driven decision making through engaging gameplay and real-world scenarios.

## Overview

Experiment Valley is a web-based educational game that simulates A/B testing scenarios. Players analyze experiments, make critical decisions, and learn from their choices while competing against different decision-making approaches. The platform bridges the gap between theoretical statistical knowledge and practical application.

## Key Features

### Interactive A/B Test Simulations
- Real-world experiment scenarios with detailed metrics
- Experiment design information (alpha, beta, sample size, etc.)
- Progress tracking showing data collection status
- Full statistical analysis with confidence intervals

### Decision-Making Challenges
- **Evaluate** experiment trustworthiness
- **Choose** the best decision based on results (deploy variant or keep running)
- **Determine** next steps to maximize impact
- Instant feedback on all decisions

### Gameplay System
- Rounds-based progression (3 experiments per round)
- Advance by correctly analyzing 2 or 3 experiments per round
- An experiment is correctly analyzed if 2 or 3 decisions are correct
- Cumulative impact tracking showing actual metric improvements

### Competition & Rankings
Compete against different decision-making approaches:
- **HiPPO**: Highest Paid Person's Opinion (ignores data, chooses variant 90%)
- **Random**: Random decision making (ignores data, chooses variant 50%)
- **Naive**: Chooses highest conversion rate at day 14, ignores statistics
- **Peek-a-boo**: Stops as soon as significance is reached, ignores data quality

Global leaderboard tracking player performance with impact-based scoring system.

### Educational Traps & Scenarios
- **Lucky Day Trap**: Recognizing when results are due to chance
- **Base Rate Mismatch**: Understanding baseline differences
- **Sample Ratio Mismatch**: Detecting allocation issues
- **Sample Size Warnings**: Understanding statistical power
- **Test Underpowered**: Recognizing insufficient sample sizes
- **Data Loss Alerts**: Identifying data quality issues
- **Overdue Experiment**: Managing long-running experiments
- **Twyman's Law**: Understanding extreme results

## Technology Stack

### Frontend
- HTML5, CSS3, JavaScript (ES6+)
- Tailwind CSS for styling
- Chart.js for data visualizations
- jStat for statistical computations
- Bootstrap 5 for UI components

### Backend
- Supabase for database and backend services
- PostgreSQL database for storing player data and sessions

### Automation
- Node.js
- Puppeteer for automated testing and player simulation

## Project Structure

```
.
├── index.html                    # Main game interface
├── about.html                    # About page with project information
├── how-to-play.html              # Game tutorial and instructions
├── leaderboard.html              # Global rankings and player statistics
├── styles.css                    # Main stylesheet
├── ev-bg.png                     # Background image
├── generated-icon.png            # Application icon
│
├── js/                           # JavaScript modules
│   ├── backend.js                # Supabase integration and API calls
│   ├── challenge-generator.js    # Generates A/B test scenarios
│   ├── chart-options.js          # Chart.js configuration
│   ├── confidence-intervals.js   # Statistical calculations
│   ├── leaderboard.js            # Leaderboard functionality
│   ├── ui-controller.js          # Main UI state management
│   ├── virtual-competitors.js    # Opponent decision-making logic
│   └── visualizations.js         # Charts and data visualizations
│
├── automation/                   # Automation tools
│   ├── automated-player.js       # Puppeteer-based automated player
│   ├── package.json              # Node.js dependencies
│   ├── test-sessions.html        # Testing interface
│   └── *.sql                     # Database schema and sample data
│
└── [trap pages]                  # Educational scenario pages
    ├── base-rate-mismatch.html
    ├── data-loss-alert.html
    ├── lucky-day-trap.html
    ├── overdue-experiment.html
    ├── sample-ratio-mismatch.html
    ├── sample-size-warning.html
    ├── test-underpowered.html
    └── twymans-law.html
```

## Getting Started

### Local Development

1. Clone this repository
2. Open `index.html` in a modern web browser
3. No server or build process required - the application runs entirely in the browser

The application uses CDN resources for all dependencies, so no local installation is needed. Simply open `index.html` and start playing!

### Automation Testing

1. Navigate to the `automation/` directory
2. Install dependencies: `npm install`
3. Run automated player: `node automated-player.js`

## How to Play

1. **Start a New Game**
   - Click "Play" on the main page
   - Enter your player name
   - Select an opponent to compete against
   - Click "Start Game"

2. **Analyze Experiments**
   - Review the experiment design (alpha, beta, sample size)
   - Check experiment progress (data collected vs. remaining)
   - Examine experiment results (metrics, daily charts, statistics)
   - Make three critical decisions:
     - Evaluate if the experiment is trustworthy
     - Choose the best decision (deploy variant or keep running)
     - Determine next steps to maximize impact

3. **Progress Through Rounds**
   - Each round contains 3 unique experiments
   - Correctly analyze 2 or 3 experiments to advance
   - Track your cumulative impact on metrics
   - Compare your performance against your selected opponent

4. **Learn from Feedback**
   - Receive instant feedback on each decision
   - Understand why decisions were correct or incorrect
   - Learn to recognize common statistical pitfalls
   - Improve your decision-making skills over time

## Dependencies

### Frontend (CDN)
- Tailwind CSS 2.x (styling)
- Chart.js (data visualization)
- Chart.js plugins (zoom, annotation)
- jStat 1.9.4 (statistical computations)
- Bootstrap 5.3.0 (UI components)
- Supabase JS SDK 2.x (backend integration)
- Google Fonts (Inter font family)

### Automation (Node.js)
- puppeteer ^24.22.3

## Database

The application uses Supabase (PostgreSQL) for:
- Player session storage
- Leaderboard data
- Experiment results tracking
- Player statistics and rankings

Database schema and sample data scripts are available in the `automation/` directory.

## Educational Value

Experiment Valley teaches:
- **Statistical analysis**: p-values, confidence intervals, significance
- **Experiment design**: sample sizes, power analysis, alpha/beta
- **Decision making**: under uncertainty with real-world constraints
- **Common pitfalls**: how to recognize and avoid statistical mistakes
- **Data quality**: assessment and interpretation
- **Proper interpretation**: of A/B test results

## Deploying to GitHub Pages

1. Create a new repository on GitHub
2. Push this code to your repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/your-username/experiment-valley.git
   git push -u origin main
   ```
3. Enable GitHub Pages in your repository settings:
   - Go to Settings > Pages
   - Source: Deploy from a branch
   - Branch: main
   - Folder: / (root)
   - Click Save

Your site will be live at `https://your-username.github.io/experiment-valley/`

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)

## Support

For questions, issues, or contributions, please use the project's issue tracker on GitHub.
