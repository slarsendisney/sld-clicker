function DonationHandler(kofiQueue, io) {
  console.log(`${kofiQueue.length} Dontaion In Queue!`);
  if (kofiQueue.length > 0) {
    const current = kofiQueue[0];
    io.emit("action", {
      type: "donation",
      data: current,
    });
    setTimeout(() => {
      kofiQueue.shift();
      DonationHandler(kofiQueue, io);
    }, parseInt(current.amount) * 10000);
  } else {
    io.emit("action", {
      type: "donationEnds",
    });
  }
}

module.exports = {
  DonationHandler,
};
