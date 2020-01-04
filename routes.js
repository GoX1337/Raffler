const express = require('express');
const path = require('path');
const router = express.Router();
const db = require('./db');
const twitter = require('./twitter');

// Serve all HTML and JS files
router.use(express.static(__dirname + '/public'));

router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname + '/public/index.html'));
});

router.get('/tweets', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    let q = {};
    if (req.query.id) {
        q.id = parseInt(req.query.id)
    }

    db.get().collection("tweets").find(q).toArray((err, result) => {
        if (err) {
            logger.error(err);
            res.status(500).send();
        }
        res.status(200).send(result);
    });
});

router.get('/stats', (req, res) => {
    db.get().collection("tweets").find({}).count((err, count) => {
        if (err) {
            logger.error(err);
            res.status(500).send();
        }
        res.status(200).send(count + " tweets");
    });
});

router.get('/dropAll', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    db.get().collection("tweets").deleteMany({}, (err, result) => {
        if (err) {
            logger.error(err);
            res.status(500).send(err);
        }
        res.status(200).send(result);
    });
});

router.get('/stream/start', (req, res) => {
    twitter.startStream();
    res.status(200).send("stream started");
});

router.get('/stream/stop', (req, res) => {
    twitter.stopStream();
    res.status(200).send("stream stopped");
});

router.get('/stream', (req, res) => {
    res.status(200).send({ state: twitter.getStream() });
});

router.get('/raffle/start', (req, res) => {
    twitter.startRaffle();
    res.status(200).send("raffle started");
});

router.get('/raffle/stop', (req, res) => {
    twitter.stopRaffle();
    res.status(200).send("raffle stopped");
});

router.get('/raffle/stats', async (req, res) => {
    let counters = await twitter.raffleStats();
    res.status(200).send(counters);
});

module.exports = router;