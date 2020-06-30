require("dotenv").config();
require("firebase/firestore");

const firebase = require("firebase");

firebase.initializeApp({
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
});
var db = firebase.firestore();
var coffeeCountRef = db.collection("coffee").doc("ko-fi");

const onChange = require("on-change");
const CronJob = require("cron").CronJob;
const express = require("express");
const fetch = require("node-fetch");
const PORT = process.env.PORT || 3000;
const INDEX = "/index.html";

const GatsbyWebHook = process.env.GATSBY_WEB_HOOK;

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
  // .use(express.json())
  .use(express.urlencoded({ extended: true }))
  .post("/kofi", function (req, res) {
    console.log(JSON.parse(req.body.data));
    const { from_name, amount } = JSON.parse(req.body.data);
    if (req.query.secret === process.env.KOFI_PASSWORD) {
      coffeeCountRef.update({
        count: firebase.firestore.FieldValue.increment(
          Math.floor(parseInt(amount) / 3)
        ),
        recent: from_name,
      });
      kofiQueue.push({ from_name, amount });
      res.sendStatus(200);
    } else {
      res.sendStatus(401);
    }
  })
  .use((req, res) => res.sendFile(INDEX, { root: __dirname }))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const io = require("socket.io")(server);

function DonationHandler() {
  console.log(`${kofiQueue.length} Dontaion In Queue!`);
  if (kofiQueue.length > 0) {
    const current = kofiQueue[0];
    io.emit("action", {
      type: "donation",
      data: current,
    });
    setTimeout(() => {
      kofiQueue.shift();
      DonationHandler();
    }, parseInt(current.amount) * 10000);
  } else {
    io.emit("action", {
      type: "donationEnds",
    });
  }
}
const template = [];

let kofiQueue = onChange(template, function (path, value, previousValue) {
  // console.log("previousValue:", previousValue);
  // console.log("Value:", value);
  if (previousValue.length === 0) {
    DonationHandler();
  }
});

const defaultPres = {
  deck: "none",
  slide: 0,
  presenter: "",
};

let pres = defaultPres;
let active = false;

io.on("connection", function (socket) {
  console.log("socket connected: " + socket.id);
  if (kofiQueue.length > 0) {
    const current = kofiQueue[0];
    io.emit("action", {
      type: "donation",
      data: current,
    });
  }
  io.emit("action", {
    type: "userCount",
    data: io.engine.clientsCount,
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
    io.emit("action", {
      type: "userCount",
      data: io.engine.clientsCount,
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
