require("dotenv").config();
const express = require("express");
const socketIO = require("socket.io");
const PORT = process.env.PORT || 3000;
const INDEX = "/index.html";

const dev = !(process.env.NODE_ENV === "production");

const server = express()
  .use((req, res) => res.sendFile(INDEX, { root: __dirname }))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const io = !dev
  ? require("socket.io")(server, {
      transports: ["xhr-polling"],
    })
  : require("socket.io")(server);

let defaultPres = {
  presenting: false,
  deck: "none",
  slide: 0,
  presenter: "",
};

let pres = defaultPres;

io.on("connection", function (socket) {
  console.log("socket connected: " + socket.id);
  if (pres.presenting) {
    socket.emit("action", {
      type: "startLivePresentor",
      data: pres,
    });
  }

  socket.on("action", (action) => {
    if (action.type === "server/hello") {
      console.log("got hello data!", action.data);
      socket.emit("action", { type: "message", data: "🍉 says hey!" });
    }
    if (action.type === "server/verify") {
      if (process.env.PRESENT_PASSWORD === action.data.password) {
        pres.presenter = socket.id;
        pres.presenting = true;
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
      pres.slide = action.data;
      io.emit("action", {
        type: "updatePresIndex",
        data: pres,
      });
    }
    if (action.type === "server/endPres") {
      io.emit("action", {
        type: "endLivePresentor",
      });
      pres = defaultPres;
    }
  });

  socket.on("disconnect", function () {
    if (socket.id === pres.presenter) {
      io.emit("action", {
        type: "endLivePresentor",
      });
      pres = defaultPres;
    }
  });
});
