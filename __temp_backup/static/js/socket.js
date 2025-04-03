// Socket.IO handler
const socket = io();

// Connection events
socket.on('connect', () => {
    console.log('Connected to server');
    updateConnectionStatus(true);
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    updateConnectionStatus(false);
});

// Join a chat room
function joinChatRoom(groupId) {
    // Leave current room if any
    if (currentGroupId) {
        socket.emit('leave_room', { room: `group_${currentGroupId}` });
    }
    
    // Join new room
    socket.emit('join_room', { room: `group_${groupId}` });
    currentGroupId = groupId;
}

// Send a message via socket
function sendMessage(content) {
    if (!currentGroupId || !content.trim()) return;
    
    socket.emit('send_message', {
        group_id: currentGroupId,
        content: content
    });
    
    // Clear input after sending
    document.getElementById('message-input').value = '';
}

// Mark message as read
function markMessageAsRead(messageId) {
    socket.emit('mark_read', {
        message_id: messageId
    });
}

// Listen for new messages
socket.on('new_message', (message) => {
    // Check if message belongs to current group
    if (message.group_id === currentGroupId) {
        appendMessage(message);
        
        // If message is not from current user, mark as read
        if (message.sender_id !== currentUserId) {
            markMessageAsRead(message.id);
        }
    } else {
        // Update unread count for the conversation
        updateUnreadCountForGroup(message.group_id);
    }
});

// Listen for message notifications
socket.on('message_notification', (notification) => {
    // Show desktop notification if permission granted
    if (Notification.permission === "granted") {
        new Notification("New message from " + notification.sender_name, {
            body: notification.content_preview
        });
    }
    
    // Update UI unread counter
    updateUnreadCountForGroup(notification.group_id);
});

// Listen for status changes
socket.on('status_change', (data) => {
    updateUserStatus(data.user_id, data.status);
});

// Listen for read receipts
socket.on('message_read', (data) => {
    updateMessageReadStatus(data.message_id, data.reader_name);
});

// Update connection status in UI
function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        if (connected) {
            statusElement.textContent = 'Connected';
            statusElement.className = 'status-online';
        } else {
            statusElement.textContent = 'Disconnected';
            statusElement.className = 'status-offline';
        }
    }
}

// Request notification permission
function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.log("This browser does not support desktop notification");
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission();
    }
}

// Initialize notification permission on page load
document.addEventListener('DOMContentLoaded', () => {
    requestNotificationPermission();
});
