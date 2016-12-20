var db = require('./db')
var express = require('express')
var app = express()

app.get('/', function (req, res) {
  res.send('Hello World!')
})

app.get('/db', function (req, res) {
  db.querySingle(req.query.stmt).then(data => res.send(JSON.stringify(data))).catch(err => res.send(error));
})

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})