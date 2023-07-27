const router = require("express").Router();
const db = require("../models");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const expiresIn = "1d";

const authenticateMe = (req) => {
  let token = false;
  if (req.headers?.authorization) {
    token = req.headers.authorization.split("Bearer: ")[1];
  }

  let data = false;
  if (token) {
    data = jwt.verify(token, process.env.PRIVATE_KEY, (err, data) => {
      if (err) {
        return null;
      } else {
        return data;
      }
    });
  }
  return data;
};

router.post("/api/signup", (req, res) => {
  db.User.create(req.body)
    .then((newUser) => {
      console.log("THIS IS NEW USER", newUser);
      const token = jwt.sign(
        {
          username: newUser.username,
          id: newUser._id,
        },
        process.env.PRIVATE_KEY,
        {
          expiresIn,
        }
      );
      return res.json({ user: newUser, token: token });
    })
    .catch((err) => {
      res.status(500).json(err);
    });
});

router.post("/api/login", (req, res) => {
  db.User.findOne({ username: req.body.username })
    .then((user) => {
      if (user && bcrypt.compareSync(req.body.password, user.password)) {
        const token = jwt.sign(
          {
            username: user.username,
            id: user.id,
          },
          process.env.PRIVATE_KEY,
          {
            expiresIn,
          }
        );
        return res.json({ user: user, token: token });
      } else {
        res.json({ err: "You have entered an invalid username or password!" });
      }
    })
    .catch((err) => {
      res.status(500).json(err);
    });
});

router.put("/api/pfp/:id", (req, res) => {
  db.User.findOneAndUpdate(
    { _id: req.params.id },
    { profilePicture: req.body.url }
  )
    .then(() => {
      res.send("profile picture updated");
    })
    .catch((err) => {
      res.status(500).json(err);
    });
});

// Authenticate user login information and populates homepage with user data
router.get("/", (req, res) => {
  let tokenData = authenticateMe(req);
  console.log("tokenData", tokenData);
  if (tokenData) {
    db.User.findOne({ _id: tokenData.id })
      .populate("records")
      .then((user) => {
        let token = req.headers.authorization.split(" ")[1];
        res.json({ user, token });
      })
      .catch((err) => {
        res.status(500).json(err);
      });
  } else {
    res.status(403).send("auth failed");
  }
});

module.exports = router;
