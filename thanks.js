const updateThanks = async function (firebase) {
  await firebase
    .firestore()
    .collection("thanks")
    .doc("thanks")
    .set(
      {
        [vote]: firebase.firestore.FieldValue.increment(1),
      },
      { merge: true }
    );
};

module.exports = {
  updateThanks,
};
