const express = require("express");
const { createClient } = require("redis");

const app = express();

const RATE_LIMITER_REQUEST_VALUES = 3;
const RATE_LIMITER_TIMEOUT = 1;

const redisClient = createClient();

redisClient.on("error", (err) => console.log("Redis Client Error", err));

redisClient.connect().then(() => {
  console.log("Redis client connected");
});

app.get("/api/v1/rate-limited", async (req, res) => {
  let [startTime, endTime, reqCount] = await Promise.all([
    redisClient.get("startTime"),
    redisClient.get("endTime"),
    redisClient.get("reqCount"),
  ]);

  const REDIS_TTL = RATE_LIMITER_TIMEOUT * 60;

  if (!reqCount || reqCount === 0) {
    startTime = Date.now(); // 2:00 pm
    endTime = startTime + RATE_LIMITER_TIMEOUT * 60 * 1000; // 2:01 pm

    await Promise.all([
      redisClient.set("startTime", startTime, {
        EX: REDIS_TTL,
      }),
      redisClient.set("endTime", endTime, {
        EX: REDIS_TTL,
      }),
    ]);
  }

  if (reqCount < RATE_LIMITER_REQUEST_VALUES && Date.now() <= endTime) {
    reqCount++;

    if (await redisClient.get("reqCount")) {
      await redisClient.set("reqCount", reqCount, {
        KEEPTTL: true,
      });
    } else {
      await redisClient.set("reqCount", reqCount, {
        EX: REDIS_TTL,
      });
    }

    res.status(200).send("Success");
  } else {
    res.status(429).send("Request Limit Exceeded");
  }
});

app.listen(8080, () => {
  console.log(`Server running at 8080`);
});
