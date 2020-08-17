const defaultPres = require("./defaultPres.json");
let pres = defaultPres;

module.exports = function (socket, io) {
  if (pres.presenter) {
    console.log(pres);
    socket.emit("action", {
      type: "startLivePresentor",
      data: pres,
    });
  }
  socket.on("action", (action) => {
    if (action.type === "server/verify") {
      if (process.env.PRESENT_PASSWORD === action.data.password) {
        console.log("Host: " + socket.id);
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
        console.log("presenter ended session");
        io.emit("action", {
          type: "endLivePresentor",
        });
        delete pres.presenter;
        console.log(pres);
      }
    }
  });
  socket.on("disconnect", function () {
    if (socket.id === pres.presenter) {
      console.log("presenter disconnect");
      io.emit("action", {
        type: "endLivePresentor",
      });
      delete pres.presenter;
      console.log(pres);
    }
  });
};
