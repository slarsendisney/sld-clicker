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

const server = express()
  // .use(express.json())
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
  .use((req, res) => res.sendFile(INDEX, { root: __dirname }))
  .listen(PORT, () => console.log(`Listening on ${PORT}`));

const io = require("socket.io")(server);

let kofiQueue = onChange([], function (path, value, previousValue) {
  if (previousValue.length === 0) {
    DonationHandler(kofiQueue, io);
  }
});

let pres = require("./defaultPres.json");

io.on("connection", function (socket) {
  console.log("socket connected: " + socket.id);
  require("./count")(socket, io);
  require("./presentation")(socket, io, pres);
  if (kofiQueue.length > 0) {
    const current = kofiQueue[0];
    io.emit("action", {
      type: "donation",
      data: current,
    });
  }
});
