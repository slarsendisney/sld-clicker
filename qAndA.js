module.exports = function (socket, firebase) {
  socket.on("action", (action) => {
    if (action.type === "server/question") {
      const { id, question } = action.data;
      firebase
        .firestore()
        .collection("QandA")
        .doc(id)
        .set(
          {
            questions: firebase.firestore.FieldValue.arrayUnion(question),
          },
          { merge: true }
        );
    }
  });
};
