EXPERIMENT VALLEY
=================

An interactive educational platform for learning A/B testing and statistical 
analysis through hands-on practice. Experiment Valley helps you understand 
statistical principles, experimental design, and data-driven decision making 
through engaging gameplay and real-world scenarios.

OVERVIEW
--------

Experiment Valley is a web-based educational game that simulates A/B testing 
scenarios. Players analyze experiments, make critical decisions, and learn from 
their choices while competing against different decision-making approaches. The 
platform bridges the gap between theoretical statistical knowledge and practical 
application.

KEY FEATURES
------------

* Interactive A/B Test Simulations
  - Real-world experiment scenarios with detailed metrics
  - Experiment design information (alpha, beta, sample size, etc.)
  - Progress tracking showing data collection status
  - Full statistical analysis with confidence intervals

* Decision-Making Challenges
  - Evaluate experiment trustworthiness
  - Choose the best decision based on results (deploy variant or keep running)
  - Determine next steps to maximize impact
  - Instant feedback on all decisions

* Gameplay System
  - Rounds-based progression (3 experiments per round)
  - Advance by correctly analyzing 2 or 3 experiments per round
  - An experiment is correctly analyzed if 2 or 3 decisions are correct
  - Cumulative impact tracking showing actual metric improvements

* Competition & Rankings
  - Compete against different decision-making approaches:
    * HiPPO: Highest Paid Person's Opinion (ignores data, chooses variant 90%)
    * Random: Random decision making (ignores data, chooses variant 50%)
    * Naive: Chooses highest conversion rate at day 14, ignores statistics
    * Peek-a-boo: Stops as soon as significance is reached, ignores data quality
  - Global leaderboard tracking player performance
  - Impact-based scoring system

* Educational Traps & Scenarios
  - Lucky Day Trap: Recognizing when results are due to chance
  - Base Rate Mismatch: Understanding baseline differences
  - Sample Ratio Mismatch: Detecting allocation issues
  - Sample Size Warnings: Understanding statistical power
  - Test Underpowered: Recognizing insufficient sample sizes
  - Data Loss Alerts: Identifying data quality issues
  - Overdue Experiment: Managing long-running experiments
  - Twyman's Law: Understanding extreme results

TECHNOLOGY STACK
----------------

Frontend:
  - HTML5, CSS3, JavaScript (ES6+)
  - Tailwind CSS for styling
  - Chart.js for data visualizations
  - jStat for statistical computations
  - Bootstrap 5 for UI components

Backend:
  - Supabase for database and backend services
  - PostgreSQL database for storing player data and sessions

Automation:
  - Node.js
  - Puppeteer for automated testing and player simulation

PROJECT STRUCTURE
-----------------

Root Directory:
  index.html              - Main game interface
  about.html              - About page with project information
  how-to-play.html        - Game tutorial and instructions
  leaderboard.html        - Global rankings and player statistics
  styles.css              - Main stylesheet
  ev-bg.png               - Background image
  generated-icon.png      - Application icon

JavaScript Modules (js/):
  backend.js               - Supabase integration and API calls
  challenge-generator.js   - Generates A/B test scenarios and experiments
  chart-options.js         - Chart.js configuration and options
  confidence-intervals.js  - Statistical calculations for confidence intervals
  leaderboard.js           - Leaderboard functionality and display
  ui-controller.js         - Main UI state management and user interactions
  virtual-competitors.js   - Implements opponent decision-making logic
  visualizations.js        - Handles charts and data visualizations

Trap/Warning Pages:
  base-rate-mismatch.html       - Base rate mismatch scenario
  data-loss-alert.html          - Data quality issues
  lucky-day-trap.html           - Lucky day trap scenario
  overdue-experiment.html       - Long-running experiment handling
  sample-ratio-mismatch.html    - Sample ratio mismatch detection
  sample-size-warning.html      - Sample size warnings
  test-underpowered.html        - Underpowered test scenarios
  twymans-law.html              - Twyman's Law educational content

Automation (automation/):
  automated-player.js     - Puppeteer-based automated player for testing
  package.json            - Node.js dependencies
  test-sessions.html      - Testing interface
  *.sql                   - Database schema and sample data scripts

GETTING STARTED
---------------

Local Development:
  1. Clone this repository
  2. Open index.html in a modern web browser
  3. No server or build process required - the application runs entirely in the browser

The application uses CDN resources for all dependencies, so no local installation 
is needed. Simply open index.html and start playing!

For Automation Testing:
  1. Navigate to the automation/ directory
  2. Install dependencies: npm install
  3. Run automated player: node automated-player.js

HOW TO PLAY
-----------

1. Start a New Game
   - Click "Play" on the main page
   - Enter your player name
   - Select an opponent to compete against
   - Click "Start Game"

2. Analyze Experiments
   - Review the experiment design (alpha, beta, sample size)
   - Check experiment progress (data collected vs. remaining)
   - Examine experiment results (metrics, daily charts, statistics)
   - Make three critical decisions:
     a. Evaluate if the experiment is trustworthy
     b. Choose the best decision (deploy variant or keep running)
     c. Determine next steps to maximize impact

3. Progress Through Rounds
   - Each round contains 3 unique experiments
   - Correctly analyze 2 or 3 experiments to advance
   - Track your cumulative impact on metrics
   - Compare your performance against your selected opponent

4. Learn from Feedback
   - Receive instant feedback on each decision
   - Understand why decisions were correct or incorrect
   - Learn to recognize common statistical pitfalls
   - Improve your decision-making skills over time

DEPENDENCIES
------------

All frontend dependencies are loaded via CDN:
  - Tailwind CSS 2.x (styling)
  - Chart.js (data visualization)
  - Chart.js plugins (zoom, annotation)
  - jStat 1.9.4 (statistical computations)
  - Bootstrap 5.3.0 (UI components)
  - Supabase JS SDK 2.x (backend integration)
  - Google Fonts (Inter font family)

Automation dependencies (Node.js):
  - puppeteer ^24.22.3

DATABASE
--------

The application uses Supabase (PostgreSQL) for:
  - Player session storage
  - Leaderboard data
  - Experiment results tracking
  - Player statistics and rankings

Database schema and sample data scripts are available in the automation/ 
directory.

EDUCATIONAL VALUE
-----------------

Experiment Valley teaches:
  - Statistical analysis (p-values, confidence intervals, significance)
  - Experiment design (sample sizes, power analysis, alpha/beta)
  - Decision making under uncertainty
  - Common statistical pitfalls and how to avoid them
  - Data quality assessment
  - Proper interpretation of A/B test results

LICENSE
-------

MIT License - See LICENSE file for details

CONTRIBUTING
------------

Pull requests are welcome! For major changes, please open an issue first to 
discuss what you would like to change.

SUPPORT
-------

For questions, issues, or contributions, please use the project's issue tracker 
on GitHub.

VERSION
-------

Current version information can be found in automation/package.json

