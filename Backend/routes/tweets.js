const express = require("express");
const router = express.Router();
const authenticateToken = require("./authenticateToken");
const fileUpload = require("../multerConfig");
const Tweet = require("../models/Tweet");

// Create a new tweet
router.post(
  "/",
  authenticateToken,
  fileUpload("images/tweet-images").single("tweet-image"),
  async (req, res) => {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Content is required!" });
    }

    try {
      const newTweet = new Tweet({
        content,
        tweetedBy: req.user.id,
      });

      if (req.file) {
        newTweet.image = req.file.path;
      }
      await newTweet.save();

      res.json({ message: "Tweet saved successfully!" });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Failed to save tweet!" });
    }
  }
);

// Get tweet details by ID
router.get("/:id", async (req, res) => {

  try {
    const tweetId = req.params.id;
    const tweet = await Tweet.findById(tweetId).populate([
      {
        path: "tweetedBy",
        select: "-password",
      },
      {
        path: "replies",
        select: "-password",
        populate: [
          {
            path: "tweetedBy",
            select: "-password",
          },
          {
            path: "retweetBy",
            select: "-password",
          },
        ],
      },
      {
        path: "retweetBy",
        select: "-password",
      },
    ]);

    if (!tweet) {
      return res.status(404).json({ error: "Tweet not found!" });
    }

    res.status(200).json(tweet);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to retrieve tweet details!" });
  }
});

// Get all tweets
router.get("/", async (req, res) => {

  try {
    const tweets = await Tweet.find()
      .populate("tweetedBy", "-password")
      .populate("retweetBy", "username")
      .populate("replies")
      .sort({ createdAt: -1 })
      .exec();

    res.json({ tweets });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to retrieve tweet details!" });
  }
});

// Delete a tweet by ID
router.delete("/:id", authenticateToken, async (req, res) => {
  const tweetId = req.params.id;
  const userId = req.user.id;
 
  try {
    const tweet = await Tweet.findById(tweetId);

    if (!tweet) {
      return res.status(404).json({ error: "Tweet not found!" });
    }

    if (tweet.tweetedBy && tweet.tweetedBy.toString() !== userId) {
      return res
        .status(403)
        .json({ error: "You are not authorized to delete this tweet!" });
    }

    await tweet.deleteOne({ _id: tweetId });

    res.json({ message: "Tweet deleted successfully!" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to delete tweet!" });
  }
});

// Like a tweet
router.post("/:id/like", authenticateToken, async (req, res) => {
  const tweetId = req.params.id;
  const userId = req.user.id;

  try {
    const tweet = await Tweet.findById(tweetId);

    if (!tweet) {
      return res.status(404).json({ error: "Tweet not found!" });
    }

    if (tweet.likes.includes(userId)) {
      return res
        .status(400)
        .json({ error: "You have already liked this tweet!" });
    }

    tweet.likes.push(userId);
    await tweet.save();

    res.json({ message: "Tweet liked successfully!", tweet });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to like tweet!" });
  }
});

// Dislike a tweet
router.post("/:id/dislike", authenticateToken, async (req, res) => {
  const tweetId = req.params.id;
  const userId = req.user.id;

  try {
    const tweet = await Tweet.findById(tweetId);

    if (!tweet) {
      return res.status(404).json({ error: "Tweet not found!" });
    }

    if (!tweet.likes.includes(userId)) {
      return res.status(400).json({ error: "You have not liked this tweet!" });
    }

    tweet.likes.pop(userId);

    await tweet.save();

    res.json({ message: "Tweet disliked successfully!", tweet });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to dislike tweet!" });
  }
});

//Reply to a tweet
router.post("/:id/reply", authenticateToken, async (req, res) => {
  const tweetId = req.params.id;
  const userId = req.user.id;
  const { content } = req.body;

  try {
    const parentTweet = await Tweet.findById(tweetId);

    if (!parentTweet) {
      return res.status(404).json({ error: "Parent tweet not found!" });
    }

    const newReply = new Tweet({
      content,
      tweetedBy: userId,
    });

    const savedReply = await newReply.save();

    parentTweet.replies.push(savedReply._id);
    await parentTweet.save();

    res.json({ message: "Reply saved successfully!", reply: savedReply });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to save reply!" });
  }
});

// Retweet a tweet
router.post("/:id/retweet", authenticateToken, async (req, res) => {
  const tweetId = req.params.id;
  const userId = req.user.id;

  try {
    const tweet = await Tweet.findById(tweetId);

    if (!tweet) {
      return res.status(404).json({ error: "Tweet not found!" });
    }

    const hasRetweeted = tweet.retweetBy.includes(userId);

    if (hasRetweeted) {
      return res
        .status(200)
        .json({ message: "You have already retweeted this tweet!" });
    }

    tweet.retweetBy.push(userId);
    await tweet.save();

    res.json({ message: "Tweet retweeted successfully!" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to retweet!" });
  }
});

module.exports = router;
