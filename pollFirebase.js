const updatePoll = async function (id, vote, firebase) {
  await firebase
    .firestore()
    .collection("polls")
    .doc(id)
    .set(
      {
        [vote]: firebase.firestore.FieldValue.increment(1),
      },
      { merge: true }
    );
  let polls = {};
  const snapshot = await firebase.firestore().collection("polls").get();
  snapshot.forEach((doc) => {
    polls[doc.id] = doc.data();
  });
  return polls;
};

const getPollState = async function (firebase) {
  let polls = {};
  const snapshot = await firebase.firestore().collection("polls").get();
  snapshot.forEach((doc) => {
    polls[doc.id] = doc.data();
  });
  return polls;
};

module.exports = {
  updatePoll,
  getPollState,
};
