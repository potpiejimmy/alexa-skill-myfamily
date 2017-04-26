/**
 * App ID for the skill
 * Prod: 'amzn1.ask.skill.a011a313-560a-42fc-a514-9fcdc5ce5ef8'
 */
var APP_ID = process.env.APP_ID;
var BACKEND_URL = 'http://sample-env.7gnri5qkiv.eu-west-1.elasticbeanstalk.com';

/**
 * The AlexaSkill prototype and helper functions
 */
var AlexaSkill = require('./skill');
var nodeFetch = require('node-fetch');

/**
 * MyFamily is a child of AlexaSkill.
 * To read more about inheritance in JavaScript, see the link below.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Introduction_to_Object-Oriented_JavaScript#Inheritance
 */
var MyFamily = function () {
    AlexaSkill.call(this, APP_ID);
};

// Extend AlexaSkill
MyFamily.prototype = Object.create(AlexaSkill.prototype);
MyFamily.prototype.constructor = MyFamily;

MyFamily.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
    console.log("MyFamily onLaunch requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId);
    invokeBackend(session, BACKEND_URL+'/member').then(body => {
        if (body.length === 0) {
            session.attributes.dialogstatus = 'addinitial';
            response.ask("Willkommen bei deiner Familie. Noch sind keine Familienmitglieder vorhanden. Verrate mir zuerst deinen Vornamen. Wie heißt du?", "Wie heißt du?");
        } else {
            var members = arrayToSpeech(body, m => m.name);
            response.askWithCard("Willkommen. Deine Familienmitglieder sind: " + members, "Was nun?", "Weltraum", members);
        }
    });
};

MyFamily.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session) {
    console.log("MyFamily onSessionStarted requestId: " + sessionStartedRequest.requestId
        + ", sessionId: " + session.sessionId);
    // any initialization logic goes here
};

MyFamily.prototype.eventHandlers.onSessionEnded = function (sessionEndedRequest, session) {
    console.log("MyFamily onSessionEnded requestId: " + sessionEndedRequest.requestId
        + ", sessionId: " + session.sessionId);
    // any cleanup logic goes here
};

MyFamily.prototype.intentHandlers = {
    // register custom intent handlers
    "AddInitialMemberIntent": function (intent, session, response) {
        setInitialMember(intent, session, response);
    },
    "AddInitialMemberMaleIntent": function (intent, session, response) {
        setInitialMemberGender(intent, session, response, 'm', 'männliche');
    },
    "AddInitialMemberFemaleIntent": function (intent, session, response) {
        setInitialMemberGender(intent, session, response, 'f', 'weibliche');
    },
    "ListMembersIntent": function (intent, session, response) {
        invokeBackend(session, BACKEND_URL+'/member')
            .then(function(body) {
                if (body.length === 0)
                    response.ask("Es sind keine Familienmitglieder vorhanden", "Was nun?");
                else {
                    var members = arrayToSpeech(body, m => m.name);
                    response.askWithCard("Deine Familienmitglieder sind: " + members, "Was nun?", "Weltraum", members);
                }
            });
    },
    "AddMemberIntent": function (intent, session, response) {
        invokeBackend(session, BACKEND_URL+'/member', {method: 'POST', body: JSON.stringify({name: intent.slots.name.value}), headers: {"Content-Type": "application/json"}})
            .then(function(body) {
                if (body.error) response.ask("Die Person " + body.error + " existiert bereits.", "Was nun?");
                else response.ask("Okay, ich habe " + intent.slots.name.value + " hinzugefügt", "Was nun?");
            });
    },
    "DeleteMembersIntent": function (intent, session, response) {
        invokeBackend(session, BACKEND_URL+'/member', {method: 'DELETE'})
            .then(function(body) {
                response.ask("Okay, ich habe alle Personen gelöscht", "Was nun?");
            });
    },
    "DeleteMemberIntent": function (intent, session, response) {
        invokeBackend(session, BACKEND_URL+'/member/' + intent.slots.name.value, {method: 'DELETE'})
            .then(function(body) {
                if (body.error) response.ask("Ich kenne die Person " + body.error + " nicht", "Was nun?");
                else response.ask("Okay, ich habe " + intent.slots.name.value + " gelöscht", "Was nun?");
            });
    },
    "SetMaleIntent": function (intent, session, response) {
        invokeBackend(session, BACKEND_URL+'/member/' + intent.slots.name.value + '?set=gender&value=m')
            .then(function(body) {
                if (body.error) response.ask("Ich kenne die Person " + body.error + " nicht", "Was nun?");
                else response.ask("Okay", "Was nun?");
            });
    },
    "SetFemaleIntent": function (intent, session, response) {
        invokeBackend(session, BACKEND_URL+'/member/' + intent.slots.name.value + '?set=gender&value=f')
            .then(function(body) {
                if (body.error) response.ask("Ich kenne die Person " + body.error + " nicht", "Was nun?");
                else response.ask("Okay", "Was nun?");
            });
    },
    "SetDateOfBirthIntent": function (intent, session, response) {
        invokeBackend(session, BACKEND_URL+'/member/' + intent.slots.name.value + '?set=birthday&value=' + intent.slots.year.value + intent.slots.birthday.value.substr(4))
            .then(function(body) {
                if (body.error) response.ask("Ich kenne die Person " + body.error + " nicht", "Was nun?");
                else response.askWithCard("Okay", "Was nun?", "Setze Geburtsdatum", intent.slots.name.value + " = " + intent.slots.birthday.value);
            });
    },
    "QueryDateOfBirthIntent": function (intent, session, response) {
        invokeBackend(session, BACKEND_URL+'/member/' + intent.slots.name.value)
            .then(function(body) {
                if (body.error) response.ask("Ich kenne die Person " + body.error + " nicht", "Was nun?");
                else response.askWithCard(body.name + " wurde am " + body.birthday + " geboren", "Was nun?", "Anfrage Geburtsdatum", body.birthday);
            });
    },
    "QueryAgeIntent": function (intent, session, response) {
        invokeBackend(session, BACKEND_URL+'/member/' + intent.slots.name.value)
            .then(function(body) {
                if (body.error) response.ask("Ich kenne die Person " + body.error + " nicht", "Was nun?");
                else response.askWithCard(body.name + " ist " + body.birthday_age + " Jahre alt", "Was nun?", "Anfrage Alter", body.birthday_age);
            });
    },
    "QueryBirthdayIntent": function (intent, session, response) {
        invokeBackend(session, BACKEND_URL+'/member/' + intent.slots.name.value)
            .then(function(body) {
                if (body.error) response.ask("Ich kenne die Person " + body.error + " nicht", "Was nun?");
                else response.askWithCard(body.name + " wird am " + body.birthday_next + " " + (body.birthday_age+1) + " Jahre alt.", "Was nun?", "Anfrage Geburtstag", body.birthday_next);
            });
    },
    "SetRelationIntent": function (intent, session, response) {
        invokeBackend(session, BACKEND_URL+'/member/' + intent.slots.name_a.value + "/rel", {method: 'POST', body: JSON.stringify({member_b: intent.slots.name_b.value, relation: intent.slots.relation.value}), headers: {"Content-Type": "application/json"}})
            .then(function(body) {
                if (body.error) response.ask("Ich kenne die Person oder die Bezeichnung " + body.error + " nicht", "Was nun?");
                else response.askWithCard("Okay, " + body.member_a + " ist " + body.member_b + "s " + body.relation, "Was nun?", "Setze Beziehung", body.member_a + " zu " + body.member_b + " = " + body.relation);
            });
    },
    "SetRelationExtIntent": function (intent, session, response) {
        invokeBackend(session, BACKEND_URL+'/member/' + intent.slots.name_a.value + "/rel", {method: 'POST', body: JSON.stringify({member_b: intent.slots.name_b.value, member_c: intent.slots.name_c.value, relation: intent.slots.relation.value}), headers: {"Content-Type": "application/json"}})
            .then(function(body) {
                if (body.error) response.ask("Ich kenne die Person oder die Bezeichnung " + body.error + " nicht", "Was nun?");
                else response.askWithCard("Okay, " + body.member_a + " ist " + body.member_b + "s und " + body.member_c + "s " + body.relation, "Was nun?", "Setze Beziehung", body.member_a + " zu " + body.member_b + ","+ body.member_c + " = " + body.relation);
            });
    },
    "SetRelationExtInvIntent": function (intent, session, response) {
        invokeBackend(session, BACKEND_URL+'/member/' + intent.slots.name_a.value + "/rel?inverse=true", {method: 'POST', body: JSON.stringify({member_b: intent.slots.name_b.value, member_c: intent.slots.name_c.value, relation: intent.slots.relation.value}), headers: {"Content-Type": "application/json"}})
            .then(function(body) {
                if (body.error) response.ask("Ich kenne die Person oder die Bezeichnung " + body.error + " nicht", "Was nun?");
                else response.askWithCard("Okay, " + body.member_a + " ist " + body.member_b + "s und " + body.member_c + "s " + body.relation, "Was nun?", "Setze Beziehung", body.member_a + " zu " + body.member_b + ","+ body.member_c + " = " + body.relation);
            });
    },
    "QueryRelationIntent": function (intent, session, response) {
        invokeBackend(session, BACKEND_URL+'/member/' + intent.slots.name.value + "/rel?reverse=true&find=" + intent.slots.relation.value)
            .then(function(body) {
                if (body.error) response.ask("Ich kenne die Person oder die Bezeichnung " + body.error + " nicht", "Was nun?");
                else {
                    var answer;
                    if (!body.length) answer = "Ich habe " + intent.slots.relation.value + " von " + intent.slots.name.value + " nicht gefunden.";
                    else answer = arrayToSpeech(body, element => element.name);
                    response.askWithCard(answer, "Was nun?", "Frage Beziehung", intent.slots.relation.value + " von " + intent.slots.name.value + " = " + answer);
                }
            });
    },
    "QueryMemberRelations": function (intent, session, response) {
        invokeBackend(session, BACKEND_URL+'/member/' + intent.slots.name.value)
            .then(function(member) {
                if (member.error) response.ask("Ich kenne die Person " + member.error + " nicht", "Was nun?");
                else {
                    invokeBackend(session, BACKEND_URL+'/member/' + intent.slots.name.value + '/rel?resolveDict=true').then(rels => {
                        if (rels.length === 0) response.ask("Du hast noch keine Beziehungsinformationen zu " + member.name + " hinterlegt.", "Was nun?");
                        else {
                            var relmap = groupBy(rels, r => r.relname);
                            var answer = member.name + " ist ";
                            answer += arrayToSpeech(Object.keys(relmap), r => arrayToSpeech(relmap[r], m => m.name + "s") + " " + r);
                            response.askWithCard(answer, "Was nun?", "Anfrage Beziehungen", answer);
                        }
                    });
                }
            });
    },
    "QuitIntent": function (intent, session, response) {
        response.tell("Auf Wiedersehen");
    },
    "AMAZON.HelpIntent": function (intent, session, response) {
        response.ask("Sag hallo.", "Sag hallo.");
    }
};

function setInitialMember(intent, session, response) {
    if (session.attributes.dialogstatus == 'addinitial') {
        var name = intent.slots.name.value;
        session.attributes.dialogstatus = 'addinitialgender';
        session.attributes.initialmember = name;
        response.ask("Hallo " + name + ". Ist " + name + " ein männlicher oder ein weiblicher Vorname?", "Sage männlich oder weiblich");
    } else {
        response.ask("Ich habe dich leider nicht verstanden, sage zum Beispiel wer ist Max oder wie alt ist David.");
    }
}

function setInitialMemberGender(intent, session, response, gender, genderfull) {
    if (session.attributes.dialogstatus == 'addinitialgender') {
        var name = session.attributes.initialmember;
        session.attributes.dialogstatus = null;
        invokeBackend(session, BACKEND_URL+'/member', {method: 'POST', body: JSON.stringify({name: name, gender: gender}), headers: {"Content-Type": "application/json"}}).then(body => {
            if (body.error) response.ask("Die Person " + body.error + " existiert bereits.", "Was nun?");
            else response.ask("Okay, ich habe die " + genderfull + " Person " + name + " hinzugefügt. Füge nun weitere Personen hinzu, indem du zum Beispiel sagst: David ist " + name + "s Sohn", "Was nun?");
        });
    } else {
        response.ask("Ich habe dich leider nicht verstanden, sage zum Beispiel wer ist Max oder wie alt ist David.");
    }
}

function groupBy(elements, criteria) {
    var groups = {};
    elements.forEach(i => {
        var crit = criteria(i);
        var mems = groups[crit];
        if (!mems) mems = [];
        mems.push(i);
        groups[crit] = mems;
    });
    return groups;
}

function arrayToSpeech(elements, appender) {
    var result = "";
    for (var i = 0; i < elements.length; i++) {
        if (i) {
            if (i === elements.length - 1) result += " und ";
            else result += ", ";
        }
        result += appender(elements[i]);
    }
    return result;
}

function invokeBackend(session, url, options) {
    url += url.indexOf("?")>=0 ? "&" : "?";
    url += "userid=" + session.user.userId;
    return nodeFetch(url, options)
        .then(function(res) {
            return res.json();
        }).catch(function(err) {
            response.tellWithCard("Fehler", "Weltraum-Fehler", "" + JSON.stringify(err));
        });
}

// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context) {
    // Create an instance of the MyFamily skill.
    var myFamily = new MyFamily();
    myFamily.execute(event, context);
};
