from flask import Flask, render_template, send_from_directory
import os

app = Flask(__name__, static_folder='js', static_url_path='/js')

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

# Serve static files from js directory
@app.route('/js/<path:path>')
def send_js(path):
    return send_from_directory('js', path)

# Serve static files from dist directory
@app.route('/dist/<path:path>')
def send_dist(path):
    return send_from_directory('dist', path)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)