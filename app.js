require("dotenv").config();
const CronJob = require("cron").CronJob;
const express = require("express");
const fetch = require("node-fetch");
const PORT = process.env.PORT || 3000;
const INDEX = "/index.html";

const GatsbyWebHook =
  "https://webhook.gatsbyjs.com/hooks/data_source/publish/2b4621eb-f392-4c7a-9db5-a36ef4173b97";

var job = new CronJob(
  "0 00 21 * * *",
  function () {
    fetch(GatsbyWebHook, { method: "POST", body: "a=1" }).then(() =>
      console.log("Pinged Gatsby")
    );
  },
  null,
  true,
  "Europe/London"
);

job.start();

const server = express()
  .use((req, res) => res.sendFile(INDEX, { root: __dirname }))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const io = require("socket.io")(server);

const defaultPres = {
  deck: "none",
  slide: 0,
  presenter: "",
};

let pres = defaultPres;
let currentCount = 0;
let active = false;

io.on("connection", function (socket) {
  console.log("socket connected: " + socket.id);
  currentCount++;
  io.emit("action", {
    type: "userCount",
    data: currentCount,
  });
  if (active) {
    socket.emit("action", {
      type: "startLivePresentor",
      data: pres,
    });
  }
  socket.on("action", (action) => {
    if (action.type === "server/verify") {
      if (process.env.PRESENT_PASSWORD === action.data.password) {
        pres.presenter = socket.id;
        active = true;
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
        active = false;
        pres = defaultPres;
      }
    }
  });

  socket.on("disconnect", function () {
    currentCount--;
    io.emit("action", {
      type: "userCount",
      data: currentCount,
    });
    if (socket.id === pres.presenter) {
      io.emit("action", {
        type: "endLivePresentor",
      });
      active = false;
      pres = defaultPres;
    }
  });
});
