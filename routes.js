const express = require('express');
const router = express.Router();
const db = require('./db');

router.get('/', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    db.get().collection("tweets").find({}).toArray((err, result) => {
        if (err) {
            logger.error(err);
            res.status(500).send();
            return;
        }
        res.status(200).send(result);
    });
});

router.get('/stats', (req, res) => {
    db.get().collection("tweets").find({}).count((err, count) => {
        if (err) {
            logger.error(err);
            res.status(500).send();
            return;
        }
        res.status(200).send(count + " tweets");
    });
});

module.exports = router;