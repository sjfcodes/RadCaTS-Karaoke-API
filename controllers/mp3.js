const router = require("express").Router();
const db = require("../models");
const cloudinary = require("./cloudinary");
const fs = require("fs");
const path = require("path");
const YoutubeMusicApi = require("youtube-music-api");
const musicApi = new YoutubeMusicApi();
const ytdl = require("ytdl-core");
const ffmpeg = require("ffmpeg");

//Download song
router.post("/api/download", async (req, res) => {
  try {
    await musicApi.initalize(); // Retrieves Innertube Config
  } catch (err) {
    console.error("musicApi.initialize", err);
    res.send("musicApi.initialize", err);
    return;
  }

  if (!req.body.name) {
    res.json({ err: "Please enter a valid input." });
    return;
  }

  let songResult;
  try {
    songResult = await musicApi.search(
      `${req.body.name} original song`,
      "song"
    );
    // console.log("songResult", JSON.stringify(songResult, null, 2));
  } catch (error) {
    console.error("musicApi.search", err);
    res.send("musicApi.search", err);
    return;
  }

  const index = 0;
  let safeName;
  let artistName;
  try {
    const songName = songResult.content[index].name.toLowerCase();
    safeName = songName.split("/").join(" ");
    artistName = songResult.content[index].artist.name.toLowerCase();

    const oneSong = await db.Song.findOne({
      name: safeName,
      artist: artistName,
    });

    if (oneSong) {
      res.send("This song already existed!");
      return;
    }
  } catch (error) {
    console.error("db.find", error);
    res.send("db.find", error);
    return;
  }

  try {
    //get and write mp4
    const videoId = songResult.content[index].videoId;
    const mp4FilePath = path.join(__dirname, `../music/mp4/test.mp4`);
    const mp4 = ytdl(`http://www.youtube.com/watch?v=${videoId}`, {
      filter: "audio",
    }).pipe(fs.createWriteStream(mp4FilePath));

    let info = await ytdl.getInfo(videoId);
    let audioFormats = ytdl.filterFormats(info.formats, "audioonly");
    console.log("Formats with only audio: " + audioFormats.length);

    mp4.on("close", () => {
      try {
        new ffmpeg(path.join(__dirname, `../music/mp4/test.mp4`)).then(
          (video) => {
            //extract mp3 from mp4
            video.fnExtractSoundToMP3(
              path.join(__dirname, `../music/mp3/test.mp3`),
              (error, file) => {
                if (error) {
                  console.error("video.fnExtractSoundToMP3", error);
                  res
                    .status(500)
                    .send({ message: "video.fnExtractSoundToMP3", error });
                  return;
                }

                cloudinary.uploader.upload(
                  file,
                  {
                    resource_type: "video",
                    public_id: `${safeName} - ${artistName}`,
                    folder: "mp3",
                    use_filename: true,
                    chunk_size: 6000000,
                  },
                  (error, result) => {
                    if (error) {
                      console.error("cloudinary.uploader.upload.error", error);
                      res.status(500).send({
                        message: "cloudinary.uploader.upload.error",
                        error,
                      });
                      return;
                    }

                    if (!result) {
                      console.error("cloudinary.uploader.upload.result");
                      res.status(500).send({
                        message: "cloudinary.uploader.upload.result missing",
                      });
                      return;
                    }

                    db.Song.create({
                      name: safeName,
                      artist: artistName,
                      mixed: result.url,
                    })
                      .then((newSong) => {
                        console.log("Downloaded: ", newSong.id);
                        res.send(newSong.id);
                      })
                      .catch((error) => {
                        console.error("db.Song.create", error);
                        res
                          .status(500)
                          .send({ message: "db.Song.create", error });
                      });
                  }
                );
              }
            );
          },
          (err) => {
            console.log("Error-ffmpeg: " + err);
            res.status(500).send({ message: "Error-ffmpeg", err });
          }
        );
      } catch (error) {
        console.error("mp4.on.close", error);
        res.status(500).send({ message: "mp4.on.close", error });
      }
    });
  } catch (error) {
    console.error("ytdl.pipe", error);
    res.status(500).send({ message: "ytdl.pipe", error });
  }
});

module.exports = router;
