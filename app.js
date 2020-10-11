require("dotenv").config();
require("firebase/firestore");

var firebase = require("firebase-admin");

var serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL,
});

var db = firebase.firestore();
var coffeeCountRef = db.collection("coffee").doc("ko-fi");
var bodyParser = require("body-parser");
const onChange = require("on-change");
const CronJob = require("cron").CronJob;
const express = require("express");
const fetch = require("node-fetch");
const PORT = process.env.PORT || 3000;
const INDEX = "/index.html";
const { DonationHandler } = require("./donations");
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

var cors = require("cors");
var allowedList = [
  "https://api.sld.codes",
  "https://sld.codes",
  "http://localhost:8000",
];
var corsOptions = {
  origin: function (origin, callback) {
    console.log(`Request from: ${origin}`);
    if (allowedList.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};

const server = express()
  .use(bodyParser.json())
  .use(express.urlencoded({ extended: true }))
  .post("/kofi", function (req, res) {
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
  .post("/thanks", cors(corsOptions), function (req, res) {
    firebase
      .firestore()
      .collection("thanks")
      .doc("thanks")
      .set(
        {
          ["count"]: firebase.firestore.FieldValue.increment(1),
        },
        { merge: true }
      )
      .then(() => res.sendStatus(200));
  })
  .post("/like", cors(corsOptions), function (req, res) {
    const { contentID, type } = req.body;
    console.log({ contentID, type });
    firebase
      .firestore()
      .collection("likes")
      .doc(contentID)
      .set(
        {
          [type]: firebase.firestore.FieldValue.increment(1),
        },
        { merge: true }
      )
      .then(() => res.sendStatus(200));
  })
  .use((req, res) => res.sendFile(INDEX, { root: __dirname }))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const io = require("socket.io")(server);

let kofiQueue = onChange([], function (path, value, previousValue) {
  if (previousValue.length === 0) {
    DonationHandler(kofiQueue, io);
  }
});

io.on("connection", function (socket) {
  console.log("socket connected: " + socket.id);
  require("./count")(socket, io);
  require("./presentation")(socket, io);
  require("./poll")(socket, io, firebase);
  require("./qAndA")(socket, firebase);
  if (kofiQueue.length > 0) {
    const current = kofiQueue[0];
    io.emit("action", {
      type: "donation",
      data: current,
    });
  }
});
