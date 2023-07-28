// Set up the Express app
require("dotenv").config();
const express = require("express");
const logger = require("morgan");
const cors = require("cors");
const mongoose = require("mongoose");
const app = express();

app.use(cors());
async function main() {
  app.use(logger("dev"));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Credentials", true);
    res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin,X-Requested-With,Content-Type,Accept,content-type,application/json"
    );
    next();
  });

  // Database
  await mongoose.connect(
    process.env.MONGO_DB_URI || "mongodb://localhost/karaoke",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  );

  app.get("/healthcheck", (_, res) => {
    res.send({ message: "hello world" });
  });

  // User Routes
  const userRoutes = require("./controllers/user");
  app.use(userRoutes);

  // Session Routes
  const sessionRoutes = require("./controllers/session");
  app.use(sessionRoutes);

  // Song Routes
  const songRoutes = require("./controllers/song");
  app.use(songRoutes);

  // Mp3 Routes
  const mp3Routes = require("./controllers/mp3");
  app.use(mp3Routes);

  // Lyrics Routes
  const lyricsRoutes = require("./controllers/lyrics");
  app.use(lyricsRoutes);

  // Server
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
  });
}
main();
