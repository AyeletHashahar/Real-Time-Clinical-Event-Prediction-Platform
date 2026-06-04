from server.routes.session_routes import session_bp
from server.routes.data_routes import data_bp
from server.routes.graph_routes import graph_bp
from server.routes.pattern_routes import pattern_bp

# Export blueprints for easy import
__all__ = ["data_bp", "graph_bp", "pattern_bp", "session_bp"]
