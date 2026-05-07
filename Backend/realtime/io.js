// Backend/realtime/io.js
const { Server } = require('socket.io');

let io = null;

/** تهيئة Socket.IO وربط الهاندلرز العامة */
function init(server, opts = {}) {
  io = new Server(server, opts);

  io.on('connection', (socket) => {
    // ====== دعم العملاء - غرف المحادثات ======
    socket.on('support:join', ({ threadId }) => {
      if (!threadId) return;
      socket.join(`support:${threadId}`);
    });
    socket.on('support:leave', ({ threadId }) => {
      if (!threadId) return;
      socket.leave(`support:${threadId}`);
    });

    // ====== (اختياري) غرف ملفات التأشيرات إن أردتها لاحقًا ======
    socket.on('join:visa', ({ id }) => {
      if (!id) return;
      socket.join(`visa:${id}`);
    });
    socket.on('leave:visa', ({ id }) => {
      if (!id) return;
      socket.leave(`visa:${id}`);
    });

    // ====== (اختياري) غرف مواعيد الجوازات إن أردتها لاحقًا ======
    socket.on('join:passport', ({ id }) => {
      if (!id) return;
      socket.join(`passport:${id}`);
    });
    socket.on('leave:passport', ({ id }) => {
      if (!id) return;
      socket.leave(`passport:${id}`);
    });
  });

  console.log('✅ Socket.IO initialized');
  return io;
}

/** احصل على نسخة io لاستخدامها في الـ controllers عند الإرسال */
function getIO() {
  if (!io) throw new Error('Socket.IO not initialized yet. Call init(server) first.');
  return io;
}

module.exports = { init, getIO };