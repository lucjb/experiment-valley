# A/B Testing Gym

An interactive educational platform for learning A/B testing concepts through hands-on practice. This is a static web application that makes it easy to understand statistical analysis and experimental design.

## Local Development

Simply open `index.html` in your web browser - no server required! The application is completely static and runs entirely in your browser.

## Project Structure

```
.
├── index.html           # Main application page
├── js/                 # JavaScript files
│   ├── challenge-generator.js  # Generates A/B test scenarios
│   ├── visualizations.js      # Handles CI and chart visualizations
│   └── progress-tracker.js    # Tracks user progress and scoring
└── README.md           # This file
```

## Features

- Interactive A/B test simulations
- Real-time statistical analysis
- Confidence interval visualizations
- Progress tracking
- Multiple difficulty levels

## Deploying to GitHub Pages

1. Fork or clone this repository
2. Enable GitHub Pages in your repository settings:
   - Go to Settings > Pages
   - Select Source: "Deploy from a branch"
   - Branch: "main" (or your preferred branch)
   - Click Save

Your site will be live at `https://<your-username>.github.io/<repository-name>/`

## Dependencies

All dependencies are loaded via CDN:
- Tailwind CSS for styling
- Chart.js for data visualization
- jStat for statistical computations

Since everything is loaded from CDNs, you don't need to install anything locally to run or develop the application.