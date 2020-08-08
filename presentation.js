module.exports = function (socket, io, pres) {
  socket.on("action", (action) => {
    if (action.type === "server/verify") {
      if (process.env.PRESENT_PASSWORD === action.data.password) {
        pres.presenter = socket.id;
        pres.deck = action.data.location;
        pres.slide = action.data.index;
        socket.emit("action", {
          type: "verify",
          data: true,
        });
        io.emit("action", {
          type: "startLivePresentor",
          data: pres,
        });
      }
    }
    if (action.type === "server/updateIndex") {
      if (socket.id === pres.presenter) {
        pres.slide = action.data;
        io.emit("action", {
          type: "updatePresIndex",
          data: pres,
        });
      }
    }
    if (action.type === "server/endPres") {
      if (socket.id === pres.presenter) {
        io.emit("action", {
          type: "endLivePresentor",
        });
        pres = require("./defaultPres.json");
      }
    }
  });
  socket.on("disconnect", function () {
    if (socket.id === pres.presenter) {
      io.emit("action", {
        type: "endLivePresentor",
      });
      pres = require("./defaultPres.json");
    }
  });
};
