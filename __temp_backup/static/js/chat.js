// Global variables
let currentUserId = null;
let currentGroupId = null;
let conversations = [];

// Initialize the chat application
document.addEventListener('DOMContentLoaded', () => {
    // Set current user ID from data attribute
    currentUserId = parseInt(document.getElementById('chat-container').dataset.userId);
    
    // Load conversations
    loadConversations();
    
    // Set up event listeners
    setupEventListeners();
});

// Load all conversations (direct and group)
function loadConversations() {
    fetch('/api/conversations')
        .then(response => response.json())
        .then(data => {
            conversations = data;
            renderConversations();
        })
        .catch(error => console.error('Error loading conversations:', error));
}

// Render conversations in sidebar
function renderConversations() {
    // Render direct chats (friends)
    const friendsList = document.getElementById('friends-list');
    friendsList.innerHTML = '';
    
    // Filter direct chats
    const directChats = conversations.filter(conv => conv.is_direct);
    
    directChats.forEach(chat => {
        const friendItem = document.createElement('div');
        friendItem.className = 'friend-item';
        friendItem.dataset.id = chat.id;
        friendItem.dataset.userId = chat.user_id;
        
        // Create status indicator
        const statusElement = document.createElement('span');
        statusElement.className = `friend-status status-${chat.status}`;
        
        // Create friend name
        const nameElement = document.createElement('span');
        nameElement.className = 'friend-name';
        nameElement.textContent = chat.name;
        
        // Create unread count if any
        let unreadElement = '';
        if (chat.unread_count > 0) {
            unreadElement = document.createElement('span');
            unreadElement.className = 'unread-count';
            unreadElement.textContent = chat.unread_count;
        }
        
        // Assemble friend item
        const leftSection = document.createElement('div');
        leftSection.className = 'd-flex align-items-center';
        leftSection.appendChild(statusElement);
        leftSection.appendChild(nameElement);
        
        friendItem.appendChild(leftSection);
        if (unreadElement) {
            friendItem.appendChild(unreadElement);
        }
        
        // Add click event
        friendItem.addEventListener('click', () => {
            openChat(chat.id, chat.name, true);
        });
        
        friendsList.appendChild(friendItem);
    });
    
    // Render group chats
    const groupsList = document.getElementById('groups-list');
    groupsList.innerHTML = '';
    
    // Filter group chats
    const groupChats = conversations.filter(conv => !conv.is_direct);
    
    groupChats.forEach(group => {
        const groupItem = document.createElement('div');
        groupItem.className = 'group-item';
        groupItem.dataset.id = group.id;
        
        // Create group name
        const nameElement = document.createElement('span');
        nameElement.className = 'group-name';
        nameElement.textContent = group.name;
        
        // Create unread count if any
        let unreadElement = '';
        if (group.unread_count > 0) {
            unreadElement = document.createElement('span');
            unreadElement.className = 'unread-count';
            unreadElement.textContent = group.unread_count;
        }
        
        // Assemble group item
        groupItem.appendChild(nameElement);
        if (unreadElement) {
            groupItem.appendChild(unreadElement);
        }
        
        // Add click event
        groupItem.addEventListener('click', () => {
            openChat(group.id, group.name, false);
        });
        
        groupsList.appendChild(groupItem);
    });
}

// Open a chat (direct or group)
function openChat(groupId, name, isDirect) {
    // Update UI
    document.querySelectorAll('.friend-item, .group-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const selector = isDirect ? '.friend-item' : '.group-item';
    document.querySelector(`${selector}[data-id="${groupId}"]`).classList.add('active');
    
    // Update chat header
    document.getElementById('chat-title').textContent = name;
    
    // Set current group id
    currentGroupId = groupId;
    
    // Clear messages
    document.getElementById('chat-messages').innerHTML = '';
    
    // Join socket room
    joinChatRoom(groupId);
    
    // Load messages
    loadMessages(groupId);
}

// Load messages for a chat
function loadMessages(groupId) {
    fetch(`/api/messages/${groupId}`)
        .then(response => response.json())
        .then(data => {
            renderMessages(data);
        })
        .catch(error => console.error('Error loading messages:', error));
}

// Render messages in the chat
function renderMessages(messages) {
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = '';
    
    messages.forEach(message => {
        appendMessage(message);
    });
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Append a single message to the chat
function appendMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.sender_id === currentUserId ? 'message-sent' : 'message-received'}`;
    messageElement.dataset.id = message.id;
    
    // Add message content
    const contentElement = document.createElement('div');
    contentElement.className = 'message-content';
    contentElement.textContent = message.content;
    messageElement.appendChild(contentElement);
    
    // Add message info
    const infoElement = document.createElement('div');
    infoElement.className = 'message-info';
    
    // Add sender name for received messages
    if (message.sender_id !== currentUserId) {
        const senderElement = document.createElement('span');
        senderElement.className = 'message-sender';
        senderElement.textContent = message.sender_name;
        infoElement.appendChild(senderElement);
    }
    
    // Add timestamp
    const timestamp = new Date(message.timestamp);
    const timeElement = document.createElement('span');
    timeElement.className = 'message-timestamp';
    timeElement.textContent = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    infoElement.appendChild(timeElement);
    
    // Add read status for sent messages
    if (message.sender_id === currentUserId) {
        const readElement = document.createElement('span');
        readElement.className = 'message-read';
        readElement.dataset.messageId = message.id;
        readElement.textContent = message.is_read ? 'Read' : 'Sent';
        infoElement.appendChild(readElement);
    }
    
    messageElement.appendChild(infoElement);
    chatMessages.appendChild(messageElement);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Set up event listeners
function setupEventListeners() {
    // Send message on button click
    document.getElementById('send-button').addEventListener('click', () => {
        const input = document.getElementById('message-input');
        sendMessage(input.value);
    });
    
    // Send message on Enter key
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const input = document.getElementById('message-input');
            sendMessage(input.value);
            e.preventDefault();
        }
    });
    
    // Toggle friends list
    document.getElementById('friends-header').addEventListener('click', () => {
        const friendsList = document.getElementById('friends-list');
        friendsList.style.display = friendsList.style.display === 'none' ? 'block' : 'none';
    });
    
    // Toggle groups list
    document.getElementById('groups-header').addEventListener('click', () => {
        const groupsList = document.getElementById('groups-list');
        groupsList.style.display = groupsList.style.display === 'none' ? 'block' : 'none';
    });
    
    // New group button
    document.getElementById('new-group-btn').addEventListener('click', () => {
        openNewGroupModal();
    });
    
    // Start direct chat button
    document.getElementById('new-chat-btn').addEventListener('click', () => {
        openNewChatModal();
    });
    
    // Modal close buttons
    document.querySelectorAll('.close, .modal-cancel').forEach(element => {
        element.addEventListener('click', () => {
            closeModals();
        });
    });
    
    // Create group form submission
    document.getElementById('create-group-form').addEventListener('submit', (e) => {
        e.preventDefault();
        createNewGroup();
    });
    
    // Start direct chat form submission
    document.getElementById('start-chat-form').addEventListener('submit', (e) => {
        e.preventDefault();
        startDirectChat();
    });
    
    // Logout button
    document.getElementById('logout-btn').addEventListener('click', () => {
        window.location.href = '/logout';
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeModals();
        }
    });
}

// Update unread count for a group
function updateUnreadCountForGroup(groupId) {
    // Find the conversation
    const conversation = conversations.find(conv => conv.id === groupId);
    if (conversation) {
        // Increment unread count
        conversation.unread_count = (conversation.unread_count || 0) + 1;
        
        // Re-render conversations
        renderConversations();
    }
}

// Update user status in UI
function updateUserStatus(userId, status) {
    // Find all friend items with this user id
    const friendItems = document.querySelectorAll(`.friend-item[data-user-id="${userId}"]`);
    
    friendItems.forEach(item => {
        const statusElement = item.querySelector('.friend-status');
        statusElement.className = `friend-status status-${status}`;
    });
    
    // Update in conversations array
    const conversation = conversations.find(conv => conv.is_direct && conv.user_id === userId);
    if (conversation) {
        conversation.status = status;
    }
}

// Update message read status
function updateMessageReadStatus(messageId, readerName) {
    const readElement = document.querySelector(`.message-read[data-message-id="${messageId}"]`);
    if (readElement) {
        readElement.textContent = 'Read by ' + readerName;
    }
}

// Open new group modal
function openNewGroupModal() {
    document.getElementById('new-group-modal').style.display = 'block';
    
    // Load users for member selection
    fetch('/api/conversations')
        .then(response => response.json())
        .then(data => {
            // Get unique users from direct chats
            const users = data
                .filter(conv => conv.is_direct)
                .map(conv => ({
                    id: conv.user_id,
                    name: conv.name
                }));
            
            // Populate member checkboxes
            const membersContainer = document.getElementById('group-members');
            membersContainer.innerHTML = '';
            
            users.forEach(user => {
                const checkbox = document.createElement('div');
                checkbox.className = 'checkbox-group';
                
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.name = 'members';
                input.value = user.id;
                input.id = `member-${user.id}`;
                
                const label = document.createElement('label');
                label.htmlFor = `member-${user.id}`;
                label.textContent = user.name;
                
                checkbox.appendChild(input);
                checkbox.appendChild(label);
                membersContainer.appendChild(checkbox);
            });
        })
        .catch(error => console.error('Error loading users:', error));
}

// Open new direct chat modal
function openNewChatModal() {
    document.getElementById('new-chat-modal').style.display = 'block';
    
    // Load users not in direct chats already
    fetch('/api/conversations')
        .then(response => response.json())
        .then(data => {
            // Get IDs of users already in direct chats
            const existingUserIds = data
                .filter(conv => conv.is_direct)
                .map(conv => conv.user_id);
            
            // Fetch all users
            fetch('/api/users')
                .then(response => response.json())
                .then(users => {
                    // Filter out users already in direct chats
                    const newUsers = users.filter(user => 
                        user.id !== currentUserId && !existingUserIds.includes(user.id)
                    );
                    
                    // Populate user select dropdown
                    const userSelect = document.getElementById('chat-user');
                    userSelect.innerHTML = '';
                    
                    newUsers.forEach(user => {
                        const option = document.createElement('option');
                        option.value = user.id;
                        option.textContent = user.username;
                        userSelect.appendChild(option);
                    });
                })
                .catch(error => console.error('Error loading all users:', error));
        })
        .catch(error => console.error('Error loading conversations:', error));
}

// Close all modals
function closeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

// Create a new group
function createNewGroup() {
    const name = document.getElementById('group-name').value.trim();
    const description = document.getElementById('group-description').value.trim();
    
    if (!name) return;
    
    // Get selected members
    const memberCheckboxes = document.querySelectorAll('input[name="members"]:checked');
    const members = Array.from(memberCheckboxes).map(checkbox => parseInt(checkbox.value));
    
    // Create group via API
    fetch('/api/create_group', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name,
            description,
            members
        })
    })
    .then(response => response.json())
    .then(data => {
        // Close modal
        closeModals();
        
        // Reload conversations
        loadConversations();
        
        // Reset form
        document.getElementById('create-group-form').reset();
    })
    .catch(error => console.error('Error creating group:', error));
}

// Start a direct chat with a user
function startDirectChat() {
    const userId = parseInt(document.getElementById('chat-user').value);
    
    if (!userId) return;
    
    // Start direct chat via API
    fetch(`/api/start_direct_chat/${userId}`)
        .then(response => response.json())
        .then(data => {
            // Close modal
            closeModals();
            
            // Reload conversations
            loadConversations();
            
            // Open the new chat
            openChat(data.id, data.name, true);
        })
        .catch(error => console.error('Error starting direct chat:', error));
}
