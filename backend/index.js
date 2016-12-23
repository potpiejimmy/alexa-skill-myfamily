var db = require('./db')
var utils = require('./utils');
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
  findMember(req.body.name).then(member => {
    if (member) res.send(member);
    else {
      req.body.name = localizePhonetics_DE(req.body.name);
      db.querySingle("insert into member set ?", [req.body]).then(data => res.send(data));
    }
  }).catch(err => res.send(err));
});

app.delete('/member', function (req, res) {
  db.querySingle("delete from member").then(data => res.send(data)).catch(err => res.send(err));
});

app.get('/member/:name', function (req, res) {
  findMember(req.params.name).then(member => {
    if (!member) {res.send("Not found"); return;}
    if (req.query.set) {
      return setMemberProperty(member.name, req.query.set, req.query.value)
              .then(data => findMember(member.name))
              .then(updatedMember => res.send(updatedMember));
    } else {
      res.send(member);
    }
  }).catch(err => res.send(err));
});

app.get('/member/:name/rel', function (req, res) {
  findMember(req.params.name).then(member => {
    if (!req.query.find) return getRelativesForMember(member, req.query.reverse);
    return db.querySingle("select * from member_rel_dict_de where relname=?", [req.query.find]).then(rel => {
      if (!rel.length) {res.send("Unknown relation: " + req.query.find); return null;}
      return getRelativesForMember(member, req.query.reverse, rel[0]);
    });
  })
  .then(data => {if (data) res.send(data);})
  .catch(err => res.send(err));
});

app.post('/member/:name/rel', function (req, res) {
  findMember(req.params.name).then(memberA => {
    if (!memberA) {res.send("Not found"); return;}
    findMember(req.body.member_b).then(memberB => {
      if (!memberB) {res.send("Not found"); return;}
      return db.querySingle("select * from member_rel_dict_de where relname=?", [req.body.relation]).then(rel => {
        if (!rel.length) {res.send("Unknown relation: " + req.body.relation); return;}
        var reldict = rel[0];
        return setMemberRelations(memberA, memberB, reldict.relation).then(data => {
          if (reldict.gender) setMemberProperty(memberA.name, "gender", reldict.gender);
          res.send(data);
        });
      });
    });
  }).catch(err => res.send(err));
});

function getRelativesForMember(member, reverse, filter) {
  var aOrB = reverse ? "member_b" : "member_a";
  var bOrA = reverse ? "member_a" : "member_b";
  var stmt = "select * from member_rel,member where member.id=" + bOrA + " and " + aOrB + "=?";
  var args = [member.id];
  if (filter) {
    if (filter.relation) {
      stmt += " and relation=?";
      args.push(filter.relation);
    }
    if (filter.gender) {
      if (!reverse && member.gender != filter.gender) {
        // invalid gender search, such as "Wessen Bruder ist Julia"
        stmt += " and member.id<0"; // filter nothing
      }
      if (reverse) {
        stmt += " and gender=?";
        args.push(filter.gender);
      }
    }
  }
  return db.querySingle(stmt, args);
};

function inverseRel(relation) {
  if (relation == "child") return "parent";
  if (relation == "parent") return "child";
  return relation;
}

function setMemberRelations(memberA, memberB, relation) {
  return setMemberRelation(memberA, memberB, relation)
         .then(res => setMemberRelation(memberB, memberA, inverseRel(relation)));
}

function setMemberRelation(memberA, memberB, relation) {
  return db.querySingle("select * from member_rel where member_a=? and member_b=?", [memberA.id, memberB.id]).then(existing => {
    if (!existing.length) {
      var newRel = {
        member_a: memberA.id,
        member_b: memberB.id,
        relation: relation
      }
      return db.querySingle("insert into member_rel set ?", [newRel]);
    } else {
      return db.querySingle("update member_rel set relation=? where member_a=? and member_b=?", [relation, memberA.id, memberB.id]);
    }
  })
}

function setMemberProperty(member, property, value) {
  return db.querySingle("update member set " + property + "=? where name=?", [value, member]);
}

function localizePhonetics_DE(name) {
  if (name.startsWith("chr")) name = "kr"+name.substr(3,name.length-3);
  if (name.startsWith("cr")) name = "kr"+name.substr(2,name.length-2);
  if (name.endsWith("er")) name = name.substr(0,name.length-2) + "a";
  return name;
}

function findMember(name) {
  var phoneticName = localizePhonetics_DE(name);
  return db.querySingle("select * from member where name sounds like ?", [phoneticName]).then(data => {
    if (data.length === 0) return null;
    return calcMemberBirthday(data[0]);
  });
}

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
  if (!member.birthday || member.birthday.length === 0) return member;
  member.birthday_age = ageForBirthday(member.birthday);
  member.birthday_next = nextBirthday(member.birthday);
  return member;
}

app.listen(process.env.PORT, function () {
  console.log('Example app listening on port ' + process.env.PORT);
})
