const { getPollState, updatePoll } = require("./pollFirebase");

module.exports = function (socket, io, firebase) {
  getPollState(firebase).then((pollState) => {
    socket.emit("action", {
      type: "pollUpdate",
      data: pollState,
    });
  });
  socket.on("action", (action) => {
    if (action.type === "server/poll") {
      const { id, vote } = action.data;
      updatePoll(id, vote, firebase).then((pollState) => {
        io.emit("action", {
          type: "pollUpdate",
          data: pollState,
        });
      });
    }
  });
};
