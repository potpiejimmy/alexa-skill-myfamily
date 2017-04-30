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
    "ConfirmIntent": function (intent, session, response) {
        if (session.attributes.dialogstatus == 'confirmsetrelation')
            setRelation(intent, session, response);
        else
            handleUnexpectedIntent(session, response);
    },
    "CancelIntent": function (intent, session, response) {
        session.attributes.dialogstatus = null;
        response.tell("Okay, ich habe abgebrochen.");
    },
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
        invokeBackend(session, BACKEND_URL+'/member/' + intent.slots.name.value + "?noFallback=true") // verify existance
            .then(function(body) {
                if (body.error) {
                    // okay, person doesn't exist yet
                    session.attributes.dialogstatus = 'addmember';
                    session.attributes.currentmember = intent.slots.name.value;
                    response.ask("Okay, wer ist " + intent.slots.name.value + "? Sage zum Beispiel: Antons Sohn, oder: Bertas Mutter, oder: die Schwester von Max.", "Was nun?");
                }
                else response.ask("Tut mir leid, die Person " + body.name + " existiert bereits.", "Was nun?");
            });
    },
    "DeleteMembersIntent": function (intent, session, response) {
        invokeBackend(session, BACKEND_URL+'/member', {method: 'DELETE'})
            .then(function(body) {
                session.attributes.dialogstatus = 'addinitial';
                response.ask("Okay, ich habe alle Personen gelöscht. Beginnen wir von vorne. Wie heißt du?", "Wie heißt du?");
            });
    },
    "DeleteMemberIntent": function (intent, session, response) {
        invokeBackend(session, BACKEND_URL+'/member/' + intent.slots.name.value, {method: 'DELETE'})
            .then(function(body) {
                if (body.error) response.ask("Ich kenne die Person " + body.error + " nicht", "Was nun?");
                else response.ask("Okay, ich habe " + body.deleted + " gelöscht", "Was nun?");
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
        if (!intent.slots.year || !intent.slots.year.value || intent.slots.year.value.length < 4) {
            response.tell("Tut mir leid, das Jahr " + (intent.slots.year ? intent.slots.year.value : "") + " ist ungültig");
        } else if (!intent.slots.birthday || !intent.slots.birthday.value || intent.slots.birthday.value.length != 10) {
            response.tell("Tut mir leid, das Datum " + (intent.slots.birthday ? intent.slots.birthday.value : "") + " ist ungültig");
        } else {
            invokeBackend(session, BACKEND_URL+'/member/' + intent.slots.name.value + '?set=birthday&value=' + intent.slots.year.value + intent.slots.birthday.value.substr(4))
                .then(function(body) {
                    if (body.error) response.ask("Ich kenne die Person " + body.error + " nicht", "Was nun?");
                    else response.askWithCard("Okay, " + body.name + " wurde am " + body.birthday + " geboren.", "Was nun?", "Setze Geburtsdatum", body.name + " = " + body.birthday);
                });
        }
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
        setRelation(intent, session, response);
    },
    "SetRelationExtIntent": function (intent, session, response) {
        setRelation(intent, session, response);
    },
    "SetRelationExtInvIntent": function (intent, session, response) {
        setRelation(intent, session, response, true);
    },
    "AddSetRelationIntent": function (intent, session, response) {
        setRelationAdding(intent, session, response);
    },
    "AddSetRelationExtIntent": function (intent, session, response) {
        setRelationAdding(intent, session, response);
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
                        if (rels.length === 0) response.ask("Du hast noch keine eindeutigen Beziehungsinformationen zu " + member.name + " hinterlegt. Um mir das Geschlecht mitzuteilen, sage " + member.name + " ist männlich oder " + member.name + " ist weiblich.", "Was nun?");
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

function handleUnexpectedIntent(session, response) {
    response.ask("Ich habe dich leider nicht verstanden. " + currentDialogInstructions(session), currentDialogInstructions(session));
}

function currentDialogInstructions(session) {
    if (session.attributes.dialogstatus == 'addinitial') {
        return "Bitte sage einen Vornamen.";
    } else if (session.attributes.dialogstatus == 'addinitialgender') {
        return "Sage männlich oder weiblich.";
    } else {
        return "Sage zum Beispiel: wer ist Max, oder: wie alt ist David.";
    }
}

function setInitialMember(intent, session, response) {
    if (session.attributes.dialogstatus == 'addinitial') {
        var name = intent.slots.name.value;
        session.attributes.dialogstatus = 'addinitialgender';
        session.attributes.currentmember = name;
        response.ask("Hallo " + name + ". Ist " + name + " ein männlicher oder ein weiblicher Vorname?", "Sage männlich oder weiblich");
    } else {
        handleUnexpectedIntent(session, response);
    }
}

function setInitialMemberGender(intent, session, response, gender, genderfull) {
    if (session.attributes.dialogstatus == 'addinitialgender') {
        var name = session.attributes.currentmember;
        session.attributes.dialogstatus = null;
        invokeBackend(session, BACKEND_URL+'/member', {method: 'POST', body: JSON.stringify({name: name, gender: gender}), headers: {"Content-Type": "application/json"}}).then(body => {
            if (body.error) response.ask("Die Person " + body.error + " existiert bereits.", "Was nun?");
            else response.ask("Okay, ich habe die " + genderfull + " Person " + name + " hinzugefügt. Füge nun weitere Personen hinzu, indem du zum Beispiel sagst: Füge David hinzu.", "Was nun?");
        });
    } else {
        handleUnexpectedIntent(session, response);
    }
}

function setRelationAdding(intent, session, response) {
    if (session.attributes.dialogstatus == 'addmember') {
        intent.slots.name_a = {value: session.attributes.currentmember};
        setRelation(intent, session, response, false, true);
    } else {
        handleUnexpectedIntent(session, response);
    }
}

function setRelation(intent, session, response, inverse, adding) {
    var setrel;
    var confirming = false;
    if (session.attributes.dialogstatus == 'confirmsetrelation') {
        session.attributes.dialogstatus = null;
        setrel = session.attributes.currentsetrel;
        confirming = true;
    } else {
        var memberrel = {
            member_b: intent.slots.name_b.value,
            relation: intent.slots.relation.value
        };
        if (intent.slots.name_c) member["member_c"] = intent.slots.name_c.value;
        setrel = {
            member: intent.slots.name_a.value,
            memberrel: memberrel,
            inverse: inverse,
            adding: adding
        };
        session.attributes.dialogstatus = 'confirmsetrelation';
        session.attributes.currentsetrel = setrel;
    }
    var queryParams = "";
    if (setrel.inverse) queryParams += "?inverse=true";
    if (setrel.adding) {
        queryParams += queryParams.length ? "&" : "?";
        queryParams += "allowAdding=true";
    }
    if (!confirming) {
        queryParams += queryParams.length ? "&" : "?";
        queryParams += "verify=true";
    }
    invokeBackend(session, BACKEND_URL+'/member/' + setrel.member + "/rel" + queryParams, {method: 'POST', body: JSON.stringify(setrel.memberrel), headers: {"Content-Type": "application/json"}})
        .then(function(body) {
            handleSetRelationResult(body, session, response, confirming);
        });
}

function handleSetRelationResult(body, session, response, confirming) {
    if (body.error) {
        session.attributes.dialogstatus = null;
        response.ask("Ich kenne die Person oder die Bezeichnung " + body.error + " nicht. Um eine neue Person hinzuzufügen, sage zum Beispiel: Füge David hinzu.", "Was nun?");
    } else {
        var answer = body.added ? "Okay, ich " + (confirming ? "habe" : "werde") + " die Person " + body.member_a + " neu " + (confirming ? "hinzugefügt" : "hinzufügen") + ". " : "Okay, ";
        answer += body.member_a + " ist " + body.member_b + "s ";
        if (body.member_c) answer += "und " + body.member_c + "s "
        answer += body.relation;
        if (body.error_c) answer += ". Die dritte Person " + body.error_c + " habe ich leider nicht gefunden";
        if (!confirming) answer += ". Ist das richtig?";
        response.askWithCard(answer, "Was nun?", "Setze Beziehung", answer);
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
