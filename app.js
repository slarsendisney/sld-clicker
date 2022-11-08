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
var whitelist = [
  "https://sld.codes",
  "https://metadream.xyz",
  "https://log.sld.codes",
  "http://localhost:8000",
  "http://localhost:3000",
  "https://sld-codes-v4.vercel.app"
];
var corsOptions = {
  origin: function (origin, callback) {
    var originIsWhitelisted = whitelist.indexOf(origin) !== -1;
    callback(null, originIsWhitelisted);
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
  .options("/subscribe", cors(corsOptions))
  .post("/subscribe", cors(corsOptions), function (req, res) {
    const { email } = req.body;
    console.log("Sub from email:" + email);
    fetch("https://api.sendgrid.com/v3/marketing/contacts", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      },
      body: JSON.stringify({
        list_ids: ["c323bc06-339c-437b-b73b-4e5c77e933f8"],
        contacts: [
          {
            email,
            custom_fields: {},
          },
        ],
      }),
    }).then(() => res.sendStatus(200));
  })
  .options("/subscribe-metadream", cors(corsOptions))
  .post("/subscribe-metadream", cors(corsOptions), function (req, res) {
    const { email } = req.body;
    console.log("Sub to metadream from email:" + email);
    fetch("https://api.sendgrid.com/v3/marketing/contacts", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
      },
      body: JSON.stringify({
        list_ids: ["01c40ae0-80ef-477e-b997-476cead4a3a5"],
        contacts: [
          {
            email,
            custom_fields: {},
          },
        ],
      }),
    }).then(() => res.sendStatus(200));
  })
  .options("/dev-post", cors(corsOptions))
  .post("/dev-post", cors(corsOptions), function (req, res) {
    const { html, currentDate, milliseconds, password } = req.body;
    if (process.env.PRESENT_PASSWORD === password) {
      firebase
        .firestore()
        .collection("logs")
        .add({
          html,
          currentDate,
          milliseconds,
        })
        .then(() => res.sendStatus(200));
    } else {
      res.sendStatus(400);
    }
  })
  .options("/dev-delete", cors(corsOptions))
  .post("/dev-delete", cors(corsOptions), function (req, res) {
    const { id, password } = req.body;
    if (process.env.PRESENT_PASSWORD === password) {
      firebase
        .firestore()
        .collection("logs")
        .doc(id)
        .delete()
        .then(() => res.sendStatus(200));
    } else {
      res.sendStatus(400);
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
