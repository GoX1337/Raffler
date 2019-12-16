var MongoClient = require('mongodb').MongoClient;

var state = {
  db: null
}

exports.connect = (url, dbname, done) => {
  if (state.db) return done();

  MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true }, (err, db) => {
    if (err) return done(err);
    state.db = db.db(dbname);
    done();
  });
}

exports.get = () => {
  return state.db;
}

exports.close = (done) => {
  if (state.db) {
    state.db.close((err, result) => {
      state.db = null;
      state.mode = null;
      done(err);
    });
  }
}