import { Socket } from "./socket.js";

console.log("Client started");

let currentRoom = 'global';
const form = document.getElementById('form');
const messageInput = document.getElementById('message');
const messages = document.getElementById('messageList');
const usernameInput = document.getElementById('username');
const roomName = document.getElementById('roomName');
const actionButton = document.getElementById('actionButton');
const roomHeader = document.getElementById('roomHeader');

let name = '';

//on input change, update the action button disabled state
roomName.addEventListener('input', () => {
    actionButton.disabled = roomName.value.trim() === '' || usernameInput.value.trim() === '';
    currentRoom = roomName.value.trim();
});

//on input change, update the action button disabled state
usernameInput.addEventListener('input', () => {
    actionButton.disabled = usernameInput.value.trim() === '' || roomName.value.trim() === '';
    name = usernameInput.value;
});

form.addEventListener('submit', (event) => {
    event.preventDefault();
    
    if (messageInput.value.trim() === '') {
        return;
    }
    addMessage('You', messageInput.value, true);
    socket.emit('message', messageInput.value, name, currentRoom, (response) => {
        console.log('Message was acknowledged by the server:', response);
    });
    messageInput.value = '';
});

actionButton.addEventListener('click', () => {
    if (actionButton.textContent === 'Join') {
        socket.emit('join', currentRoom, usernameInput.value, (response) => {
            console.log('Joined the room successfully:', response);
            roomHeader.textContent = `Connected to Room: ${roomName.value}`;
        });
    } else {
        socket.emit('leave', currentRoom, usernameInput.value, (response) => {
            console.log('Left the room successfully:', response);
            roomHeader.textContent = 'Join a room to chat';
            clearMessages();
        });
    }
});

const socket = new Socket("ws://localhost:3000/ws");

socket.on("connect", () => {
    console.log("Connected to server", socket.isOpen);
});

socket.on("disconnect", () => {
    console.log("Disconnected from server", socket.isOpen);
    roomHeader.textContent = 'Join a room to chat';
    serverMessage('server.leave', 'Disconnected from server');
});

function clearMessages() {
    while (messages.firstChild) {
        messages.removeChild(messages.firstChild);
    }
}

function addMessage(name, msg, self = false) {
    const message = document.createElement('li');
    if (self) {
        message.classList.add('sent');
    } else {
        message.classList.add('received');
    }
    const username = document.createElement('div');
    username.classList.add('username');
    const text = document.createElement('div');
    text.classList.add('msg');
    username.textContent = name;
    text.textContent = msg;
    message.appendChild(username);
    message.appendChild(text);
    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;
}

socket.on("message", (data, username) => {
    console.log("Message:", data);
    addMessage(username, data);
});

socket.on("server", (data, className) => {
    console.log("Server message:", data);
    serverMessage(className, data);
});

function serverMessage(className, data) {
    const message = document.createElement('li');
    message.classList.add(className, 'server');
    const name = document.createElement('div');
    name.classList.add('username');
    const text = document.createElement('div');
    text.classList.add('msg');
    name.textContent = 'Server';
    text.textContent = data;
    message.appendChild(name);
    message.appendChild(text);
    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;
}