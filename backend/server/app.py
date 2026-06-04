# # server/app.py
# from flask import Flask
# from flask_socketio import SocketIO
# from flask_cors import CORS
#
# app = Flask(__name__)
# CORS(app)  # Enable CORS for all routes
# socketio = SocketIO(app, cors_allowed_origins="*", ping_timeout=10, ping_interval=10)
#

from flask import Flask
from flask_socketio import SocketIO
from flask_cors import CORS

# Import blueprints from routes package
from server.routes import session_bp, data_bp, graph_bp, pattern_bp
import logging

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
socketio = SocketIO(app, cors_allowed_origins="*", ping_timeout=10, ping_interval=10)

# Configure logging once
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Register blueprints
app.register_blueprint(session_bp)
app.register_blueprint(data_bp)
app.register_blueprint(graph_bp)
app.register_blueprint(pattern_bp)

@app.route("/")
def index():
    return "WebSocket server running with modular blueprints."
