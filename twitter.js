const Twitter = require('twitter');
const logger = require('./logger');
const db = require('./db');

const twitter = new Twitter({
    consumer_key: process.env.consumer_key,
    consumer_secret: process.env.consumer_secret,
    access_token_key: process.env.access_token_key,
    access_token_secret: process.env.access_token_secret
});

let raffleStream = null;

let oembedUpdate = () => {
    twitter.get('statuses/oembed', { id: tweet.id_str }, (err, response) => {
        if (err) {
            logger.error('statuses/oembed ' + JSON.stringify(err));
            return;
        }

        tweet.html = response.html;
        db.get().collection("tweets").insertOne(tweet, (err, result) => {
            if (err) {
                logger.error("get tweets " + JSON.stringify(err));
                return;
            }
            logger.info(url);
        });
    });
}

let processTweet = (tweet) => {

    const url = "https://twitter.com/" + tweet.user.screen_name + "/status/" + tweet.id_str;

    if (tweet.retweeted_status || tweet.in_reply_to_status_id || tweet.in_reply_to_status_id_str 
        || tweet.in_reply_to_user_id || tweet.in_reply_to_user_id_str || tweet.in_reply_to_screen_name) {
        logger.info(url + " is a response");
        return;
    }
    else if (tweet.id_str && tweet.quoted_status && tweet.id_str != tweet.quoted_status) {
        logger.info(url + " is a quote");
        return;
    }
    else {
        logger.info(url);
    }

    db.get().collection("tweets").findOne({ id: tweet.id_str }, (err, tweetDb) => {
        if (!tweetDb) {
            db.get().collection("tweets").insertOne(tweet, (err, result) => {
                if (err) {
                    logger.error("get tweets " + JSON.stringify(err));
                    return;
                }
            });
        } else {
            logger.warn(url + " already in database");
        }
    });
}

let processError = (error) => {
    logger.error("processError " + JSON.stringify(err));
}

module.exports.startStream = () => {
    logger.info("Start stream");
    twitter.stream('statuses/filter', { track: '#CONCOURS, CONCOURS' }, stream => {
        raffleStream = stream;
        stream.on('data', processTweet);
        stream.on('error', processError);
    });
}

module.exports.stopStream = () => {
    logger.info("Stop stream");
    if (raffleStream) {
        raffleStream.destroy();
        raffleStream = null;
    }
}

module.exports.getStream = () => {
    return raffleStream ? true : false;
}

