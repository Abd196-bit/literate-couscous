# Swift.io Chat Application

A real-time chat application built with Flask and WebSockets, featuring a retro-inspired pixel font interface and unique design elements.

## Features

- User registration and authentication
- Real-time messaging with WebSockets
- Group chat and direct messaging
- Online/offline status indicators
- Read receipts
- Distinctive pixel font UI design
- Dark mode interface with yellow accents

## Technologies Used

- Backend: Flask, Flask-SocketIO, SQLAlchemy
- Database: SQLite
- Frontend: HTML, CSS, JavaScript
- Real-time communication: Socket.IO
- Session management: Flask-Session
- Authentication: Flask-Login

## Installation and Setup

1. Clone the repository:
   ```
   git clone https://github.com/Abd196-bit/swift.io.git
   cd swift.io
   ```

2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Run the application:
   ```
   python main.py
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:5000
   ```

## Project Structure

- `auth.py`: Authentication routes and form handling
- `chat.py`: Chat functionality and WebSocket events
- `models.py`: Database models
- `app.py`: Application setup and configuration
- `main.py`: Entry point for the application
- `static/`: Static files (CSS, JavaScript, fonts)
- `templates/`: HTML templates

## License

MIT