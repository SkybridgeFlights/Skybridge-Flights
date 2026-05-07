// frontend/src/realtime/socket.js
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../apiConfig';

let socket;

export function getSocket() {
  if (!socket) {
    socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
  }
  return socket;
}