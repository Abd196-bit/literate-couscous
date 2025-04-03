from flask import Blueprint, render_template, jsonify, request, abort
from flask_login import login_required, current_user
from app import db, socketio
from models import User, Group, Message, ReadReceipt, user_group
from flask_socketio import emit, join_room, leave_room
from datetime import datetime
import json
import logging
from sqlalchemy import or_, and_

# Configure logging
logger = logging.getLogger(__name__)

chat_bp = Blueprint('chat', __name__)

@chat_bp.route('/chat')
@login_required
def chat_page():
    logger.info(f"Chat page accessed by: {current_user.username}")
    try:
        users = User.query.filter(User.id != current_user.id).all()
        logger.info(f"Found {len(users)} users")
        user_groups = current_user.groups.filter_by(is_direct_chat=False).all()
        logger.info(f"Found {len(user_groups)} groups")
        logger.info("Rendering chat.html template")
        return render_template('chat.html', users=users, groups=user_groups)
    except Exception as e:
        logger.error(f"Error in chat_page route: {str(e)}")
        logger.exception("Exception details:")
        raise

@chat_bp.route('/api/users')
@login_required
def get_users():
    logger.info(f"Getting users list for: {current_user.username}")
    users = User.query.filter(User.id != current_user.id).all()
    user_list = [{
        'id': user.id,
        'username': user.username,
        'status': user.status
    } for user in users]
    return jsonify(user_list)

@chat_bp.route('/api/conversations')
@login_required
def get_conversations():
    # Get all groups the user is in (including direct chats)
    user_groups = current_user.groups.all()
    
    conversations = []
    for group in user_groups:
        # For direct chats, get the other user
        if group.is_direct_chat:
            other_user = None
            for member in group.members:
                if member.id != current_user.id:
                    other_user = member
                    break
            
            if other_user:
                # Get last message and unread count
                last_message = Message.query.filter_by(group_id=group.id).order_by(Message.timestamp.desc()).first()
                unread_count = Message.query.filter_by(
                    group_id=group.id, 
                    is_read=False
                ).filter(Message.sender_id != current_user.id).count()
                
                conversations.append({
                    'id': group.id,
                    'name': other_user.username,
                    'is_direct': True,
                    'user_id': other_user.id,
                    'status': other_user.status,
                    'last_message': last_message.content if last_message else None,
                    'last_message_time': last_message.timestamp.isoformat() if last_message else None,
                    'unread_count': unread_count
                })
        else:
            # For group chats
            last_message = Message.query.filter_by(group_id=group.id).order_by(Message.timestamp.desc()).first()
            unread_count = Message.query.filter_by(
                group_id=group.id, 
                is_read=False
            ).filter(Message.sender_id != current_user.id).count()
            
            conversations.append({
                'id': group.id,
                'name': group.name,
                'is_direct': False,
                'description': group.description,
                'last_message': last_message.content if last_message else None,
                'last_message_time': last_message.timestamp.isoformat() if last_message else None,
                'unread_count': unread_count
            })
    
    return jsonify(conversations)

@chat_bp.route('/api/messages/<int:group_id>')
@login_required
def get_messages(group_id):
    # Verify user is member of the group
    group = Group.query.get_or_404(group_id)
    if current_user not in group.members:
        abort(403)
    
    # Get messages from the group
    messages = Message.query.filter_by(group_id=group_id).order_by(Message.timestamp).all()
    
    # Mark messages as read
    unread_messages = Message.query.filter_by(
        group_id=group_id,
        is_read=False
    ).filter(Message.sender_id != current_user.id).all()
    
    for message in unread_messages:
        message.is_read = True
        # Create read receipt
        receipt = ReadReceipt(
            message_id=message.id,
            user_id=current_user.id
        )
        db.session.add(receipt)
    
    db.session.commit()
    
    # Format messages
    message_list = []
    for message in messages:
        sender = User.query.get(message.sender_id)
        message_list.append({
            'id': message.id,
            'content': message.content,
            'sender_id': message.sender_id,
            'sender_name': sender.username,
            'timestamp': message.timestamp.isoformat(),
            'is_read': message.is_read
        })
    
    return jsonify(message_list)

@chat_bp.route('/api/create_group', methods=['POST'])
@login_required
def create_group():
    data = request.json
    name = data.get('name')
    description = data.get('description', '')
    member_ids = data.get('members', [])
    
    if not name:
        return jsonify({'error': 'Group name is required'}), 400
    
    # Create new group
    group = Group(
        name=name,
        description=description,
        creator_id=current_user.id,
        is_direct_chat=False
    )
    
    # Add current user to group
    group.members.append(current_user)
    
    # Add other members
    for member_id in member_ids:
        user = User.query.get(member_id)
        if user and user != current_user:
            group.members.append(user)
    
    db.session.add(group)
    db.session.commit()
    
    return jsonify({
        'id': group.id,
        'name': group.name,
        'description': group.description
    })

@chat_bp.route('/api/start_direct_chat/<int:user_id>')
@login_required
def start_direct_chat(user_id):
    other_user = User.query.get_or_404(user_id)
    
    # Check if direct chat already exists
    existing_chat = db.session.query(Group).join(
        user_group, Group.id == user_group.c.group_id
    ).filter(
        Group.is_direct_chat == True,
        user_group.c.user_id == current_user.id
    ).join(
        user_group, Group.id == user_group.c.group_id
    ).filter(
        user_group.c.user_id == other_user.id
    ).first()
    
    if existing_chat:
        return jsonify({
            'id': existing_chat.id,
            'name': other_user.username,
            'is_direct': True
        })
    
    # Create new direct chat
    group_name = f"Direct: {current_user.username} and {other_user.username}"
    group = Group(
        name=group_name,
        creator_id=current_user.id,
        is_direct_chat=True
    )
    
    # Add both users to the chat
    group.members.append(current_user)
    group.members.append(other_user)
    
    db.session.add(group)
    db.session.commit()
    
    return jsonify({
        'id': group.id,
        'name': other_user.username,
        'is_direct': True
    })

# Socket.IO events
@socketio.on('connect')
def handle_connect():
    if current_user.is_authenticated:
        # Join a room named after the user's ID for direct notifications
        join_room(f"user_{current_user.id}")
        current_user.status = 'online'
        db.session.commit()
        
        # Notify others that user is online
        emit('status_change', {
            'user_id': current_user.id,
            'status': 'online'
        }, broadcast=True)

@socketio.on('disconnect')
def handle_disconnect():
    if current_user.is_authenticated:
        current_user.status = 'offline'
        db.session.commit()
        
        # Notify others that user is offline
        emit('status_change', {
            'user_id': current_user.id,
            'status': 'offline'
        }, broadcast=True)

@socketio.on('join_room')
def handle_join_room(data):
    room = data['room']
    join_room(room)

@socketio.on('leave_room')
def handle_leave_room(data):
    room = data['room']
    leave_room(room)

@socketio.on('send_message')
def handle_message(data):
    if not current_user.is_authenticated:
        return
    
    group_id = data['group_id']
    content = data['content']
    
    # Verify user is member of the group
    group = Group.query.get(group_id)
    if not group or current_user not in group.members:
        return
    
    # Create and save message
    message = Message(
        content=content,
        sender_id=current_user.id,
        group_id=group_id
    )
    db.session.add(message)
    db.session.commit()
    
    # Format response
    message_data = {
        'id': message.id,
        'content': message.content,
        'sender_id': message.sender_id,
        'sender_name': current_user.username,
        'timestamp': message.timestamp.isoformat(),
        'is_read': False,
        'group_id': group_id
    }
    
    # Emit to all users in the group
    emit('new_message', message_data, room=f"group_{group_id}")
    
    # Send notifications to all group members
    for member in group.members:
        if member.id != current_user.id:
            emit('message_notification', {
                'group_id': group_id,
                'sender_name': current_user.username,
                'content_preview': content[:30] + ('...' if len(content) > 30 else '')
            }, room=f"user_{member.id}")

@socketio.on('mark_read')
def handle_mark_read(data):
    message_id = data['message_id']
    
    message = Message.query.get(message_id)
    if not message or current_user.id == message.sender_id:
        return
    
    message.is_read = True
    
    # Create read receipt
    receipt = ReadReceipt(
        message_id=message_id,
        user_id=current_user.id
    )
    db.session.add(receipt)
    db.session.commit()
    
    # Notify sender that message was read
    emit('message_read', {
        'message_id': message_id,
        'reader_id': current_user.id,
        'reader_name': current_user.username
    }, room=f"user_{message.sender_id}")
