from app import app, socketio

# This is for Gunicorn to use when serving the app
# The application variable needs to be 'app' for Gunicorn

if __name__ == "__main__":
    # In development, use the built-in Flask server
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, allow_unsafe_werkzeug=True)
