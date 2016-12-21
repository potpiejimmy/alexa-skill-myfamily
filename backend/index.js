var db = require('./db')
var bodyparser = require('body-parser')
var express = require('express')
var app = express();

app.use(bodyparser.json());

app.get('/', function (req, res) {
  res.send('My Family is up and running')
})

app.get('/db', function (req, res) {
  db.querySingle(req.query.stmt).then(data => res.send(JSON.stringify(data))).catch(err => res.send(err));
})

app.get('/member', function (req, res) {
  db.querySingle("select * from member").then(data => res.send(data)).catch(err => res.send(err));
});

app.post('/member', function (req, res) {
  db.querySingle("insert into member set ?", [req.body]).then(data => res.send(data)).catch(err => res.send(err));
});

app.delete('/member', function (req, res) {
  db.querySingle("delete from member").then(data => res.send(data)).catch(err => res.send(err));
});

app.listen(process.env.PORT, function () {
  console.log('Example app listening on port ' + process.env.PORT);
})
