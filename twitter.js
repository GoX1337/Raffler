const Twitter = require('twitter');
const logger = require('./logger');
const db = require('./db');

const twitter = new Twitter({
	consumer_key: process.env.consumer_key,
	consumer_secret: process.env.consumer_secret,
	access_token_key: process.env.access_token_key,
	access_token_secret: process.env.access_token_secret
});

let oembedUpdate = () => {
    twitter.get('statuses/oembed', { id: tweet.id_str }, (err, response) => {
        if(err){
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

    db.get().collection("tweets").findOne({ _id: tweet.id_str }, (err, tweetDb) => {
        if(!tweetDb){
            db.get().collection("tweets").insertOne(tweet, (err, result) => {
                if (err) {
                    logger.error("get tweets " + JSON.stringify(err));
                    return;
                }
                logger.info(url);
            });
        } else {
            logger.warn(url + " already in database");
        }
    });
}

let processError = (error) => {
    logger.error("processError " + JSON.stringify(err));
}

twitter.stream('statuses/filter', { track: '#CONCOURS, CONCOURS' }, stream => {
    stream.on('data', processTweet);
    stream.on('error', processError);
});


