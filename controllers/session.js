const router = require("express").Router();
const db = require("../models");
const jwt_decode = require("jwt-decode");

// Deletes all stored sessions
router.delete("/api/session/deleteAll", (req, res) => {
  db.Session.remove().then(() => {
    res.send("All sessions deleted!");
  });
});

// Creates a new karaoke session
// Req.body format we need from frontend =
// {
//    host: user_id,
//    karaokeSong: song_id (comes from the search through /api/song route)
//    karaokeLyrics: lyrics_id
// }
// Returns the new session's id
router.post("/api/session", (req, res) => {
  db.Session.create(req.body)
    .then((data) => {
      res.json(data._id);
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send({ message: error.message });
    });
});

// Finds created session by id
// Returns all of karaoke song's data and lyrics
router.get("/api/session/:id", (req, res) => {
  db.Session.findOne({ _id: req.params.id })
    .populate("karaokeSong")
    .populate("karaokeLyrics")
    .then((sessionData) => {
      res.json(sessionData);
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send({ message: error.message });
    });
});

// At the end of each karaoke session
// Req.body we need from frontend =
// {
//    token: "token",
//    score: number
// }
router.put("/api/session/:id", async (req, res) => {
  // 1. Finds user via token and add the karaoke session to their records
  const user = jwt_decode(req.body.token);
  try {
    const updatedUser = await db.User.findOneAndUpdate(
      { _id: user.id },
      { $addToSet: { records: [req.params.id] } }
    );
    console.log("updatedUser", updatedUser);

    // 2. Updates Session.members with the user's id and Session.scores with the user's score
    const updatedSession = await db.Session.findOneAndUpdate(
      { _id: req.params.id },
      {
        $addToSet: {
          members: [user.id],
          scores: [{ [user.id]: req.body.score }],
        },
      }
    );
    console.log("updatedSession", updatedSession);
    res.send({ message: "success!" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: error.message });
  }
});

router.put("/api/session/lyrics/:sessionId", (req, res) => {
  db.Session.findOneAndUpdate(
    { _id: req.params.sessionId },
    { karaokeLyrics: req.body.lyricsId }
  )
    .then(() => {
      res.send("Lyrics added to session!");
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send({ message: error.message });
    });
});

module.exports = router;
