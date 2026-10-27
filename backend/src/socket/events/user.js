// Legacy user/connect handler — kept for the existing frontend which
// emits `user/connect` after socket open. New clients put their access
// token in the handshake auth payload (see socketServer.js); presence
// then binds automatically. Client-supplied userId is NEVER trusted:
// without a verified handshake JWT we refuse the bind so a stranger
// cannot join another user's room. When verified, we always bind the
// JWT subject and ignore any client-supplied id.

const mongoose = require("mongoose");
const presence = require("../presence");

module.exports = (socket) => {
  socket.on("user/connect", async () => {
    try {
      if (!socket.verifiedUserId) {
        socket.emit("auth/required", { event: "user/connect" });
        return;
      }
      const id = String(socket.verifiedUserId);
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error(`Invalid user ID: ${id}`);
      }
      socket.join(id);
      socket.userId = id;
      await presence.addConnection(id, socket.id);
      socket.broadcast.emit("user/connect", id);
    } catch (error) {
      console.error(`Error in user/connect: ${error.message}`);
    }
  });
};
