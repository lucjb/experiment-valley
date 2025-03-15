# A/B Testing Gym

An interactive educational platform for learning A/B testing concepts through hands-on practice.

## Requirements

- Python 3.11 or higher
- Flask

## Installation

1. Clone this repository to your local machine:
```bash
git clone <your-repo-url>
cd ab-testing-gym
```

2. Create a virtual environment and activate it:
```bash
python -m venv venv
# On Windows
venv\Scripts\activate
# On macOS/Linux
source venv/bin/activate
```

3. Install the required packages:
```bash
pip install flask
```

## Running the Application

1. Start the Flask server:
```bash
python main.py
```

2. Open your web browser and navigate to:
```
http://localhost:5000
```

## Project Structure

```
.
├── README.md
├── main.py              # Flask server
├── index.html          # Main application page
└── js/                 # JavaScript files
    ├── challenge-generator.js
    ├── visualizations.js
    └── progress-tracker.js
```

## Features

- Interactive A/B test simulations
- Real-time statistical analysis
- Confidence interval visualizations
- Progress tracking
- Multiple difficulty levels

## Development

The application is built using:
- Flask for serving static files
- Chart.js for data visualization
- Tailwind CSS for styling
- jStat for statistical computations
