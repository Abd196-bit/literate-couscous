import os
import logging
import secrets
import eventlet

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from flask_socketio import SocketIO
from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect
from flask_session import Session

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Create a declarative base for SQLAlchemy models
class Base(DeclarativeBase):
    pass

# Initialize extensions
db = SQLAlchemy(model_class=Base)
socketio = SocketIO(async_mode=None)
login_manager = LoginManager()
csrf = CSRFProtect()
sess = Session()

# Create the Flask application
app = Flask(__name__)
# Generate a secure secret key if one isn't set in the environment
app.secret_key = os.environ.get("SESSION_SECRET", secrets.token_hex(16))

# Flask session configuration
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_PERMANENT'] = True
app.config['SESSION_USE_SIGNER'] = True
app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production with HTTPS
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# CSRF protection configuration
app.config['WTF_CSRF_ENABLED'] = True
app.config['WTF_CSRF_SECRET_KEY'] = app.secret_key
app.config['WTF_CSRF_SSL_STRICT'] = False  # More permissive during development

# Configure the database - use SQLite for development
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///chat.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Initialize extensions with the app
db.init_app(app)
socketio.init_app(app, cors_allowed_origins="*", manage_session=False)
login_manager.init_app(app)
csrf.init_app(app)
sess.init_app(app)
login_manager.login_view = 'auth.login'
login_manager.login_message = 'Please log in to access this page.'
login_manager.login_message_category = 'info'

# Register blueprints
from auth import auth_bp
from chat import chat_bp
from download import download_bp

app.register_blueprint(auth_bp)
app.register_blueprint(chat_bp)
app.register_blueprint(download_bp)

# Create database tables
with app.app_context():
    import models
    db.create_all()

# Configure the login manager
from models import User

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))
