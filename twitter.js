const Twitter = require('twitter');
const logger = require('./logger');
const db = require('./db');
const moment = require('moment');

const twitter = new Twitter({
    consumer_key: process.env.consumer_key,
    consumer_secret: process.env.consumer_secret,
    access_token_key: process.env.access_token_key,
    access_token_secret: process.env.access_token_secret
});

let raffleStream = null;
let raffleTimer = null;
let streamStarted = false;
let raffleStarted = false;
const delay = 30;
const RAFFLE = "RAFFLE";
const STREAM = "STREAM";

let retweet = async (tweet) => {
    return new Promise(resolve => {
        twitter.post('statuses/retweet/' + tweet.id_str, (err, tweet, response) => {
            if (err) {
                logger.error(RAFFLE + " RT failed " + JSON.stringify(err));
            } else {
                logger.info(RAFFLE + " RT " + tweet.id_str + " OK");
            }
            resolve();
        });  
    });
}

let followUser = async (tweet, user) => {
    return new Promise((resolve, reject) => {
        twitter.post('friendships/create', { user_id: user.id_str, follow: true }, (err, resp) => {
            if (err){
                logger.error(RAFFLE + " Follow " + user.id_str + " failed cause:" + JSON.stringify(err));
                reject(new Error("Whoops!"));
            } else {
                logger.info(RAFFLE + " Follow " + user.id_str + " done (" + tweet.id_str + ")");
                resolve();
            }
        });
    });
}

let countTweets = async (query) => {
    return new Promise(resolve => {
        db.get().collection("tweets").countDocuments(query, (err, count) => {
            resolve(count);
        });
    });
}

let buildTweetUrl = (tweet) => {
    return "https://twitter.com/" + tweet.user.screen_name + "/status/" + tweet.id_str;
}

let getInstructions = (tweet) => {
    let text = tweet.extended_tweet ? tweet.extended_tweet.full_text : tweet.text;
    text = text.toUpperCase();
    return {
        follow: text.includes("FOLLOW") || text.includes("SUIVRE"),
        like: text.includes("LIKE") || text.includes("AIME"),
        rt: text.includes("RT")
    }
}

let processTweet = (t) => {
    let tweet = t;
    let url = buildTweetUrl(tweet);

    if (tweet.retweeted_status) {
        tweet = tweet.retweeted_status;
        url = buildTweetUrl(tweet);
        logger.info(STREAM + " " + url + " is a RT");
    }
    else if(tweet.in_reply_to_status_id || tweet.in_reply_to_status_id_str){
        url = buildTweetUrl(tweet);
        logger.info(STREAM + " " + url + " is a response");
        return; // ignore it at the moment
    }
    else if (tweet.id_str && tweet.quoted_status && tweet.id_str != tweet.quoted_status) {
        tweet = tweet.quoted_status;
        url = buildTweetUrl(tweet);
        logger.info(STREAM + " " + url + " is a quote");
    }
    else {
        logger.info(STREAM + " " + url);
    }

    db.get().collection("tweets").findOne({ id_str: tweet.id_str }, (err, tweetDb) => {
        if (!tweetDb) {
            db.get().collection("tweets").insertOne(tweet, (err, result) => {
                if (err) {
                    logger.error("STREAM get tweets " + JSON.stringify(err));
                    return;
                }
            });
        } else {
            logger.warn(STREAM + " " + url + " already in database");
        }
    });
}

let processError = (err) => {
    logger.error(STREAM + " processError " + JSON.stringify(err));
}

let getOneTweetToRaffle = async () => {
    return new Promise(resolve => {
        db.get().collection("tweets").find({"processed" : { $ne: true }}).sort({_id: 1}).limit(1).toArray((err, result) => {
            if(!err){
                resolve(result[0]);
            }
        }); 
    });
}

let updateTweet = async (tweet, inst) => {
    return new Promise(resolve => {
        db.get().collection("tweets").updateOne({ "_id": tweet._id }, { $set: {processed: true} }, (err, result) => {
            if (err) {
                logger.error(RAFFLE + " update processed : " + JSON.stringify(err));
                throw new Error(err);
            }
            logger.info(RAFFLE + " processed tweet " + tweet.id_str + " " + JSON.stringify(inst));
            resolve();
        });
    });
}

let raffleProcess = async () => {
    let tweet = await getOneTweetToRaffle();
    if(!tweet){
        logger.warn(RAFFLE + " No more tweet in db to process");
        return;
    }
    let inst = getInstructions(tweet);
    if(!inst.rt && !inst.follow){
        logger.warn(RAFFLE + " No instruction, it is not a raffle tweet");
        await updateTweet(tweet, inst);
        return;
    }

    logger.info(RAFFLE + " 1-----------------");
    if(inst.rt){
        await retweet(tweet);
    }
    logger.info(RAFFLE + " 2-----------------");
    let followFailed = false;
    if(inst.follow && tweet.extended_tweet && tweet.extended_tweet.entities && tweet.extended_tweet.entities.user_mentions){
        await Promise.all(
            tweet.extended_tweet.entities.user_mentions.map(async user => {
                await followUser(tweet, user).catch((err) => { throw new Error("Whoops!") });
            })
        ).catch(e => {
            logger.warn(RAFFLE + " cant follow an user, cancel raffle");
            followFailed = true;
        });
    }
 
    // An user follow failed, we stop here, and will process this tweet later 
    if(followFailed){
        this.stopRaffle();
        let now = moment(); 
        let tomorrow = moment().add(1, 'day');
        tomorrow.set({hour:0,minute:0,second:0,millisecond:0});
        let duration = moment.duration(tomorrow.diff(now));
        logger.warn(RAFFLE + " frezze raffle timer for " + duration + " ms");
        setTimeout(() => {
            this.startRaffle();
        }, duration);
        return;
    }

    logger.info(RAFFLE + " 3-----------------");
    await updateTweet(tweet, inst);
    logger.info(RAFFLE + " 4-----------------");
};

module.exports.startStream = () => {
    logger.info("BOT Start stream");
    streamStarted = true;
    twitter.stream('statuses/filter', { track: '#CONCOURS, CONCOURS' }, stream => {
        raffleStream = stream;
        stream.on('data', processTweet);
        stream.on('error', processError);
    });
}

module.exports.stopStream = () => {
    logger.info("BOT Stop stream");
    streamStarted = false;
    if (raffleStream) {
        raffleStream.destroy();
        raffleStream = null;
    }
}

module.exports.startRaffle = () => {
    logger.info("BOT Start raffle");
    raffleStarted = true;
    raffleTimer = setInterval(raffleProcess, delay * 1000);
}

module.exports.stopRaffle = () => {
    logger.info("BOT Stop raffle");
    raffleStarted = false;
    if(raffleTimer){
        clearInterval(raffleTimer);
        raffleTimer = null;
    }
}

module.exports.getStream = () => {
    return raffleStream ? true : false;
}

module.exports.raffleStats = async () => {
    let total = await countTweets();
    let processed = await countTweets({ processed: true });
    return { total:total, processed: processed };
}
