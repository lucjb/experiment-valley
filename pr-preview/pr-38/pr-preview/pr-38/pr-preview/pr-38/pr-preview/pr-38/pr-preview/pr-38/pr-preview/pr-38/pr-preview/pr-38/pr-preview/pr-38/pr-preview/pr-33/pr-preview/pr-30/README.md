# A/B Testing Gym

An interactive educational platform for learning A/B testing concepts through hands-on practice. This web application helps you understand statistical analysis and experimental design through practical exercises.

## Features

- Interactive A/B test simulations with real-time feedback
- Statistical visualization with confidence intervals
- Multiple difficulty levels
- Progress tracking and scoring
- Comprehensive statistical analysis tools
- Intuitive data visualization

## Live Demo

Visit [https://your-username.github.io/ab-testing-gym](https://your-username.github.io/ab-testing-gym) (update this URL after deployment)

## Local Development

Simply clone this repository and open `index.html` in your web browser - no server required! The application is completely static and runs entirely in your browser.

## Project Structure

```
.
├── index.html              # Main application page
├── js/                    # JavaScript files
│   ├── challenge-generator.js    # Generates A/B test scenarios
│   └── visualizations.js        # Handles CI and chart visualizations
└── README.md              # This file
```

## Deploying to GitHub Pages

1. Create a new repository on GitHub
2. Push this code to your repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/your-username/ab-testing-gym.git
   git push -u origin main
   ```
3. Enable GitHub Pages in your repository settings:
   - Go to Settings > Pages
   - Source: Deploy from a branch
   - Branch: main
   - Folder: / (root)
   - Click Save

Your site will be live at `https://your-username.github.io/ab-testing-gym/`

## Dependencies

All dependencies are loaded via CDN:
- Tailwind CSS for styling
- Chart.js for data visualization
- jStat for statistical computations

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)