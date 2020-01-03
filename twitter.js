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
let raffleTimer = null;

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

let retweet = (tweet) => {
	twitter.post('statuses/retweet/' + tweet.id_str, (err, tweet, response) => {
		if (err) {
            logger.error("RT failed " + JSON.stringify(err));
            return;
		} else {
            logger.info("RT " + tweet.id_str + " OK");
		}
	});
}

let followUser = (tweet, user) => {
	twitter.post('friendships/create', { user_id: user.id_str, follow: true }, (err, resp) => {
		if (err)
			logger.error("Follow " + user.id_str + " failed cause:" + JSON.stringify(err));
		logger.info("Follow " + user.id_str + " done (" + tweet.id_str + ")");
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
        logger.info(url + " is a RT");
    }
    else if(tweet.in_reply_to_status_id || tweet.in_reply_to_status_id_str){
        url = buildTweetUrl(tweet);
        logger.info(url + " is a response");
        return; // ignore it at the moment
    }
    else if (tweet.id_str && tweet.quoted_status && tweet.id_str != tweet.quoted_status) {
        tweet = tweet.quoted_status;
        url = buildTweetUrl(tweet);
        logger.info(url + " is a quote");
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

let processError = (err) => {
    logger.error("processError " + JSON.stringify(err));
}

let raffleProcess = () => {
    db.get().collection("tweets").find({"processed" : { $ne: true }}).sort({_id: 1}).limit(1).toArray((err, result) => {
        if (err) {
            logger.error(err);
        }
        let tweet = result[0];
        let inst = getInstructions(tweet);
        if(inst.rt){
            retweet(tweet);
        }
        if(inst.follow && tweet.entities && tweet.entities.user_mentions){
            tweet.entities.user_mentions.forEach(user => {
                followUser(tweet, user);
            });
        }

        db.get().collection("tweets").updateOne({ "_id": tweet._id }, { $set: {processed: true} }, (err, result) => {
            if (err) {
                logger.error("update processed : " + JSON.stringify(err));
                return;
            }
            logger.info("Raffle processed tweet " + tweet.id_str + " " + JSON.stringify(inst));
        });
    });
};

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

module.exports.startRaffle = () => {
    logger.info("Start raffle");
    raffleTimer = setInterval(raffleProcess, 30000);
}

module.exports.stopRaffle = () => {
    logger.info("Stop raffle");
    if(raffleTimer){
        clearInterval(raffleTimer);
        raffleTimer = null;
    }
}

module.exports.getStream = () => {
    return raffleStream ? true : false;
}

