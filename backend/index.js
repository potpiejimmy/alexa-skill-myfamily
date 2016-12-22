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

app.get('/member/:name', function (req, res) {
  if (req.query.set) {
    db.querySingle("update member set " + req.query.set + "=? where name=?", [req.query.value, req.params.name]).catch(err => console.log(err));
  }
  db.querySingle("select * from member where name=?", [req.params.name]).then(data => res.send(calcMemberBirthday(data[0]))).catch(err => res.send(err));
});

function ageForBirthday(birthday) {
  return new Date((Date.now() - new Date(birthday).getTime())).getUTCFullYear() - 1970;
}

function nextBirthday(birthday) {
  var d = new Date(birthday);
  while (d.getTime() < Date.now()) {
    d.setUTCFullYear(d.getUTCFullYear() + 1);
  }
  return d.toISOString().substr(0,10);
}

function calcMemberBirthday(member) {
  member.birthday_age = ageForBirthday(member.birthday);
  member.birthday_next = nextBirthday(member.birthday);
  return member;
}

app.listen(process.env.PORT, function () {
  console.log('Example app listening on port ' + process.env.PORT);
})
