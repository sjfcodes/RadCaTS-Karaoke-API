const router = require("express").Router();
const db = require("../models");
const fs = require("fs");
const path = require("path");
const YoutubeMusicApi = require("youtube-music-api");
const ytdl = require("ytdl-core");
const ffmpeg = require("ffmpeg");

const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { s3Client } = require("../libs/s3Client");

//Download song
router.post("/api/download", async (req, res) => {
  if (!req.body.name) {
    res.json({ err: "Please enter a valid input." });
    return;
  }

  const musicApi = new YoutubeMusicApi();
  try {
    await musicApi.initalize(); // Retrieves Innertube Config
  } catch (err) {
    console.error("musicApi.initialize", err);
    res.send("musicApi.initialize", err);
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
      res.send({ message: "Found existing song in database!", data: oneSong });
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
    const mp4FilePath = path.join(__dirname, `../temp/video.mp4`);
    const mp4 = ytdl(`http://www.youtube.com/watch?v=${videoId}`, {
      filter: "audio",
    }).pipe(fs.createWriteStream(mp4FilePath));

    const targetFormat = "audioonly";
    const videoInfo = await ytdl.getInfo(videoId);
    const audioFormats = ytdl.filterFormats(videoInfo.formats, targetFormat);
    console.log(
      `found ${audioFormats.length} formats matching "${targetFormat}"`
    );

    mp4.on("close", async () => {
      try {
        const video = await new ffmpeg(mp4FilePath);
        const pathToMp3File = await video.fnExtractSoundToMP3(
          path.join(__dirname, `../temp/audio.mp3`)
        );

        const fileName = `/${safeName}_${artistName}.mp3`.replaceAll(" ", "_");
        const params = {
          Bucket: "radcats-karaoke",
          Key: "audio" + fileName,
          Body: fs.readFileSync(pathToMp3File),
          ContentType: "audio/mpeg",
        };
        await s3Client.send(new PutObjectCommand(params));

        const newSong = await db.Song.create({
          name: safeName,
          artist: artistName,
          bucketKey: fileName,
        });

        res.send(newSong.id);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: error.message });
      }
    });
  } catch (error) {
    console.error("ytdl.pipe", error);
    res.status(500).send({ message: "ytdl.pipe", error });
  }
});

module.exports = router;
