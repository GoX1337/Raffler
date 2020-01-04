const express = require('express');
const app = express();
const logger = require('./logger');
const db = require('./db');
const config = require('./config');
const routes = require('./routes');
const twitter = require('./twitter');

app.use('/', routes);

app.listen(config.port, () => {
    db.connect(config.dbUrl, config.dbName, (err) => {
		if (err) {
			logger.error("Problem to connect to mongodb.", err);
			process.exit(1);
        }
        logger.info("BOT Started");
	});
});