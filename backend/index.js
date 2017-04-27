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
  db.querySingle("select * from member where userid=?",[req.query.userid]).then(data => res.send(data)).catch(err => res.send(err));
});

app.post('/member', function (req, res) {
  findMember(req.query.userid, req.body.name, true).then(member => {
    if (member) res.send({error:member.name});
    else {
      addMember(req, req.body).then(data => res.send(data));
    }
  }).catch(err => res.send(err));
});

app.delete('/member', function (req, res) {
  db.querySingle("delete r from member_rel r join member m on r.member_a=m.id where m.userid=?",[req.query.userid])
    .then(data => db.querySingle("delete from member where userid=?",[req.query.userid]))
    .then(data => res.send(data))
    .catch(err => res.send(err));
});

app.get('/member/:name', function (req, res) {
  findMember(req.query.userid, req.params.name).then(member => {
    if (!member) {res.send({error:req.params.name}); return;}
    if (req.query.set) {
      return setMemberProperty(member.name, req.query.set, req.query.value)
              .then(data => findMember(req.query.userid, member.name))
              .then(updatedMember => res.send(updatedMember));
    } else {
      res.send(member);
    }
  }).catch(err => res.send(err));
});

app.delete('/member/:name', function (req, res) {
  findMember(req.query.userid, req.params.name).then(member => {
    if (!member) {res.send({error:req.params.name}); return;}
    return db.querySingle("delete from member_rel where member_a=? or member_b=?", [member.id, member.id])
             .then(data => db.querySingle("delete from member where id=?", [member.id]))
             .then(data => res.send(data));
  }).catch(err => res.send(err));
});

app.get('/member/:name/rel', function (req, res) {
  findMember(req.query.userid, req.params.name).then(member => {
    if (!req.query.find) return getRelativesForMember(member, req.query.reverse, null, req.query.resolveDict);
    return db.querySingle("select * from member_rel_dict_de where relname=?", [req.query.find]).then(rel => {
      if (!rel.length) {res.send({error:req.query.find}); return null;}
      return getRelativesForMember(member, req.query.reverse, rel[0]);
    });
  })
  .then(data => {if (data) res.send(data);})
  .catch(err => res.send(err));
});

app.post('/member/:name/rel', function (req, res) {
  findMember(req.query.userid, req.body.member_b).then(memberB => {
    if (!memberB) {res.send({error:req.body.member_b}); return;} // unknown, not allowed
    return findMember(req.query.userid, req.params.name).then(memberA => {
      if (!memberA && !req.query.inverse) return addMember(req, {name:req.params.name}); else return memberA;  // add A on the fly if not found (only in non-inverse mode)
    }).then(memberA => {
      if (!memberA) {res.send({error:req.params.name}); return;} // adding failed or inverse mode, not allowed
      return db.querySingle("select * from member_rel_dict_de where relname=?", [req.body.relation]).then(rel => {
        if (!rel.length) {res.send({error:req.body.relation}); return;}
        var reldict = rel[0];
        return setMemberRelationsRecurseAll(memberA.id, memberB.id, req.query.inverse ? inverseRel(reldict.relation) : reldict.relation).then(data => {
          if (reldict.gender) setMemberProperty(memberA.name, "gender", reldict.gender);
          if (req.body.member_c) {
            // optional: additonal member C for setting the same relation in one step
            return findMember(req.query.userid, req.body.member_c).then(memberC => {
              if (!memberC) {
                res.send({
                  member_a: memberA.name,
                  member_b: memberB.name,
                  relation: req.body.relation,
                  error_c:  req.body.member_c
                });
              } else {
                return setMemberRelationsRecurseAll(memberA.id, memberC.id, req.query.inverse ? inverseRel(reldict.relation) : reldict.relation).then(data => {
                  res.send({
                    member_a: memberA.name,
                    member_b: memberB.name,
                    member_c: memberC.name,
                    relation: req.body.relation
                  });
                });
              }
            });
          } else {
            res.send({
              member_a: memberA.name,
              member_b: memberB.name,
              relation: req.body.relation
            });
          }
        });
      });
    });
  }).catch(err => res.send(err));
});

function addMember(req, member) {
  member.name = localizePhonetics_DE(member.name);
  member.userid = req.query.userid;
  return db.querySingle("insert into member set ?", [member]).then(() => findMember(req.query.userid, member.name));
}

function getRelativesForMember(member, reverse, filter, resolveDict) {
  var aOrB = reverse ? "member_b" : "member_a";
  var bOrA = reverse ? "member_a" : "member_b";
  var stmt = "select * from member_rel,member";
  if (resolveDict) stmt += ",member_rel_dict_de where member_rel_dict_de.relation=member_rel.relation and member_rel_dict_de.gender=? and member_rel_dict_de.prio=1 and";
  else stmt += " where";
  stmt +=" member.id=" + bOrA + " and " + aOrB + "=?";
  var args = [];
  if (resolveDict) args.push(member.gender);
  args.push(member.id);
  if (filter) {
    if (filter.relation) {
      stmt += " and member_rel.relation=?";
      args.push(filter.relation);
    }
    if (filter.gender) {
      if (!reverse && member.gender != filter.gender) {
        // invalid gender search, such as "Wessen Bruder ist Julia"
        stmt += " and member.id<0"; // filter nothing
      }
      if (reverse) {
        stmt += " and member.gender=?";
        args.push(filter.gender);
      }
    }
  }
  stmt += " order by member_rel.relation";
  return db.querySingle(stmt, args);
};

function inverseRel(relation) {
  if (relation == "child") return "parent";
  if (relation == "parent") return "child";
  if (relation == "parentsibling") return "siblingchild";
  if (relation == "siblingchild") return "parentsibling";
  if (relation == "grandchild") return "grandparent";
  if (relation == "grandparent") return "grandchild";
  return relation;
}

function transRel(relationA, relationB) {
  if (relationA == "child" && relationB == "parent") return "sibling";
  if (relationA == "sibling" && relationB == "sibling") return "sibling";
  if (relationA == "child" && relationB == "sibling") return "siblingchild";
  if (relationA == "sibling" && relationB == "parent") return "parentsibling";
  if (relationA == "siblingchild" && relationB == "parent") return "cousin";
  if (relationA == "child" && relationB == "parentsibling") return "cousin";
  if (relationA == "child" && relationB == "child") return "grandchild";
  if (relationA == "parent" && relationB == "parent") return "grandparent";
  if (relationA == "child" && relationB == "grandparent") return "parentsibling";
  if (relationA == "grandchild" && relationB == "parent") return "siblingchild";
  return null;
}

function setMemberRelationsRecurseAll(memberA, memberB, relation) {
  return setMemberRelations(memberA, memberB, relation, true)
         .then(res => setMemberRelationsTransitive(memberA, memberB, relation))
         .then(res => setMemberRelationsTransitive(memberB, memberA, inverseRel(relation)));
}

function setMemberRelationsTransitive(memberA, memberB, relation) {
  return db.querySingle("select * from member_rel where member_a=?", [memberB])
         .then(rels => utils.asyncLoopP(rels, (i, next) => {
           var tr = transRel(relation, i.relation);
           if (tr && memberA!==i.member_b) setMemberRelations(memberA, i.member_b, tr, false).then(data => next());
           else next();
         }))
         .then(() => {return {result:"okay"}});
}

function setMemberRelations(memberA, memberB, relation, override) {
  return setMemberRelation(memberA, memberB, relation, override)
         .then(res => setMemberRelation(memberB, memberA, inverseRel(relation), override));
}

function setMemberRelation(memberA, memberB, relation, override) {
  return db.querySingle("select * from member_rel where member_a=? and member_b=?", [memberA, memberB]).then(existing => {
    if (!existing.length) {
      var newRel = {
        member_a: memberA,
        member_b: memberB,
        relation: relation
      }
      return db.querySingle("insert into member_rel set ?", [newRel]);
    } else {
      if (override) 
        return db.querySingle("update member_rel set relation=? where member_a=? and member_b=?", [relation, memberA, memberB]);
      else
        return existing[0];
    }
  })
}

function setMemberProperty(member, property, value) {
  return db.querySingle("update member set " + property + "=? where name=?", [value, member]);
}

function localizePhonetics_DE(name) {
  if (name.startsWith("chr")) name = "kr"+name.substr(3);
  if (name.startsWith("cr")) name = "kr"+name.substr(2);
  if (name.startsWith("cl")) name = "kl"+name.substr(2);
  if (name.startsWith("cn")) name = "kn"+name.substr(2);
  if (name.startsWith("v")) name = "w"+name.substr(1);
  if (name.endsWith("er")) name = name.substr(0,name.length-2) + "a";
  return name;
}

function findMember(userid, name, noFallback) {
  var phoneticName = localizePhonetics_DE(name);
  return db.querySingle("select * from member where userid=? and name sounds like ?", [userid, phoneticName]).then(data => {
    if (data.length === 0) {
      if (noFallback) return null;
      return db.querySingle("select * from member where userid=? and substr(name,1,4) sounds like ?", [userid, phoneticName.substring(0,4)]).then(data => {
        if (data.length === 0) return null;
        return calcMemberBirthday(data[0]);
      });
    }
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
