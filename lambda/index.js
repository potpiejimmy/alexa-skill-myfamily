'use strict';
var Alexa = require('alexa-sdk');
var nodeFetch = require('node-fetch');
 
var BACKEND_URL = 'http://sample-env.7gnri5qkiv.eu-west-1.elasticbeanstalk.com';

exports.handler = function(event, context, callback){
    var alexa = Alexa.handler(event, context);
    alexa.registerHandlers(handlers);
    alexa.execute();
};

var handlers = {
    "LaunchRequest": function() {
        invokeBackend.call(this, BACKEND_URL+'/member').then(body => {
            if (body.length === 0) {
                this.attributes.dialogstatus = 'addinitial';
                this.emit(':ask', "Willkommen bei deiner Familie. Noch sind keine Familienmitglieder vorhanden. Sage: Familie einrichten, um zu beginnen", "Sage: Familie einrichten");
            } else {
                var members = arrayToSpeech(body, m => m.name);
                this.emit(':askWithCard', "Willkommen. Deine Familienmitglieder sind: " + members, "Was nun?", "Weltraum", members);
            }
        });
    },
    "AddInitialMemberIntent": function () {
        if (this.event.request.dialogState !== 'COMPLETED'){
            this.emit(':delegate');
        } else {
            setInitialMember.call(this);
        }
    },
    /*
    // register custom intent handlers
    "AMAZON.YesIntent": function () {
        if (this.attributes.dialogstatus == 'confirmsetrelation')
            setRelation.call(this);
        else
            handleUnexpectedIntent.call(this);
    },
    "AMAZON.NoIntent": function () {
        cancel.call(this);
    },
    "AddInitialMemberMaleIntent": function () {
        setInitialMemberGender.call(this, 'm', 'männliche');
    },
    "AddInitialMemberFemaleIntent": function () {
        setInitialMemberGender.call(this, 'f', 'weibliche');
    },
    "ListMembersIntent": function () {
        invokeBackend.call(this, BACKEND_URL+'/member')
            .then(function(body) {
                if (body.length === 0)
                    this.emit(':ask', "Es sind keine Familienmitglieder vorhanden", "Was nun?");
                else {
                    var members = arrayToSpeech(body, m => m.name);
                    this.emit(':askWithCard', "Deine Familienmitglieder sind: " + members, "Was nun?", "Weltraum", members);
                }
            });
    },
    "AddMemberIntent": function () {
        invokeBackend.call(this, BACKEND_URL+'/member/' + this.event.request.intent.slots.name.value + "?noFallback=true") // verify existance
            .then(function(body) {
                if (body.error) {
                    // okay, person doesn't exist yet
                    this.attributes.dialogstatus = 'addmember';
                    this.attributes.currentmember = this.event.request.intent.slots.name.value;
                    this.emit(':ask', "Okay, wer ist " + this.event.request.intent.slots.name.value + "? Sage zum Beispiel: Antons Sohn, oder: die Schwester von Max, oder abbrechen, wenn ich dich falsch verstanden habe.", "Was nun?");
                }
                else this.emit(':ask', "Tut mir leid, die Person " + body.name + " existiert bereits.", "Was nun?");
            });
    },
    "DeleteMembersIntent": function () {
        invokeBackend.call(this, BACKEND_URL+'/member', {method: 'DELETE'})
            .then(function(body) {
                this.attributes.dialogstatus = 'addinitial';
                this.emit(':ask', "Okay, ich habe alle Personen gelöscht. Beginnen wir von vorne. Wie heißt du?", "Wie heißt du?");
            });
    },
    "DeleteMemberIntent": function () {
        invokeBackend.call(this, BACKEND_URL+'/member/' + this.event.request.intent.slots.name.value, {method: 'DELETE'})
            .then(function(body) {
                if (body.error) this.emit(':ask', "Ich kenne die Person " + body.error + " nicht", "Was nun?");
                else this.emit(':ask', "Okay, ich habe " + body.deleted + " gelöscht", "Was nun?");
            });
    },
    "SetMaleIntent": function () {
        invokeBackend.call(this, BACKEND_URL+'/member/' + this.event.request.intent.slots.name.value + '?set=gender&value=m')
            .then(function(body) {
                if (body.error) this.emit(':ask', "Ich kenne die Person " + body.error + " nicht", "Was nun?");
                else this.emit(':ask', "Okay", "Was nun?");
            });
    },
    "SetFemaleIntent": function () {
        invokeBackend.call(this, BACKEND_URL+'/member/' + this.event.request.intent.slots.name.value + '?set=gender&value=f')
            .then(function(body) {
                if (body.error) this.emit(':ask', "Ich kenne die Person " + body.error + " nicht", "Was nun?");
                else this.emit(':ask', "Okay", "Was nun?");
            });
    },
    "SetDateOfBirthIntent": function () {
        if (!this.event.request.intent.slots.year || !this.event.request.intent.slots.year.value || this.event.request.intent.slots.year.value.length < 4) {
            this.emit(':tell', "Tut mir leid, das Jahr " + (this.event.request.intent.slots.year ? this.event.request.intent.slots.year.value : "") + " ist ungültig");
        } else if (!this.event.request.intent.slots.birthday || !this.event.request.intent.slots.birthday.value || this.event.request.intent.slots.birthday.value.length != 10) {
            this.emit(':tell', "Tut mir leid, das Datum " + (this.event.request.intent.slots.birthday ? this.event.request.intent.slots.birthday.value : "") + " ist ungültig");
        } else {
            invokeBackend.call(this, BACKEND_URL+'/member/' + this.event.request.intent.slots.name.value + '?set=birthday&value=' + this.event.request.intent.slots.year.value + this.event.request.intent.slots.birthday.value.substr(4))
                .then(function(body) {
                    if (body.error) this.emit(':ask', "Ich kenne die Person " + body.error + " nicht", "Was nun?");
                    else this.emit(':askWithCard', "Okay, " + body.name + " wurde am " + body.birthday + " geboren.", "Was nun?", "Setze Geburtsdatum", body.name + " = " + body.birthday);
                });
        }
    },
    "SetBirthdayTestIntent": function () {
        this.emit(':ask', "Ich habe verstanden: " + this.event.request.intent.slots.birthday.value);
    },
    "QueryDateOfBirthIntent": function () {
        invokeBackend.call(this, BACKEND_URL+'/member/' + this.event.request.intent.slots.name.value)
            .then(function(body) {
                if (body.error) this.emit(':ask', "Ich kenne die Person " + body.error + " nicht", "Was nun?");
                else if (!body.birthday) this.emit(':tell', "Ich weiß leider nicht, was das Geburtsdatum von " + body.name + " ist.");
                else this.emit(':askWithCard', body.name + " wurde am " + body.birthday + " geboren", "Was nun?", "Anfrage Geburtsdatum", body.birthday);
            });
    },
    "QueryAgeIntent": function () {
        invokeBackend.call(this, BACKEND_URL+'/member/' + this.event.request.intent.slots.name.value)
            .then(function(body) {
                if (body.error) this.emit(':ask', "Ich kenne die Person " + body.error + " nicht", "Was nun?");
                else if (!body.birthday) this.emit(':tell', "Ich weiß leider nicht, was das Geburtsdatum von " + body.name + " ist.");
                else this.emit(':askWithCard', body.name + " ist " + body.birthday_age + " Jahre alt", "Was nun?", "Anfrage Alter", body.birthday_age);
            });
    },
    "QueryBirthdayIntent": function () {
        invokeBackend.call(this, BACKEND_URL+'/member/' + this.event.request.intent.slots.name.value)
            .then(function(body) {
                if (body.error) this.emit(':ask', "Ich kenne die Person " + body.error + " nicht", "Was nun?");
                else if (!body.birthday) this.emit(':tell', "Ich weiß leider nicht, was das Geburtsdatum von " + body.name + " ist.");
                else this.emit(':askWithCard', body.name + " wird am " + body.birthday_next + " " + (body.birthday_age+1) + " Jahre alt.", "Was nun?", "Anfrage Geburtstag", body.birthday_next);
            });
    },
    "SetRelationIntent": function () {
        setRelation.call(this);
    },
    "SetRelationExtIntent": function () {
        setRelation.call(this);
    },
    "SetRelationExtInvIntent": function () {
        setRelation.call(this, true);
    },
    "AddSetRelationIntent": function () {
        setRelationAdding.call(this);
    },
    "AddSetRelationExtIntent": function () {
        setRelationAdding.call(this);
    },
    "QueryRelationIntent": function () {
        invokeBackend.call(this, BACKEND_URL+'/member/' + this.event.request.intent.slots.name.value + "/rel?reverse=true&find=" + this.event.request.intent.slots.relation.value)
            .then(function(body) {
                if (body.error) this.emit(':ask', "Ich kenne die Person oder die Bezeichnung " + body.error + " nicht", "Was nun?");
                else {
                    var answer;
                    if (!body.length) answer = "Ich habe " + this.event.request.intent.slots.relation.value + " von " + this.event.request.intent.slots.name.value + " nicht gefunden.";
                    else answer = arrayToSpeech(body, element => element.name);
                    this.emit(':askWithCard', answer, "Was nun?", "Frage Beziehung", this.event.request.intent.slots.relation.value + " von " + this.event.request.intent.slots.name.value + " = " + answer);
                }
            });
    },
    "QueryMemberRelations": function () {
        invokeBackend.call(this, BACKEND_URL+'/member/' + this.event.request.intent.slots.name.value)
            .then(function(member) {
                if (member.error) this.emit(':ask', "Ich kenne die Person " + member.error + " nicht", "Was nun?");
                else {
                    invokeBackend.call(this, BACKEND_URL+'/member/' + this.event.request.intent.slots.name.value + '/rel?resolveDict=true').then(rels => {
                        if (rels.length === 0) this.emit(':ask', "Du hast noch keine eindeutigen Beziehungsinformationen zu " + member.name + " hinterlegt. Um mir das Geschlecht mitzuteilen, sage " + member.name + " ist männlich oder " + member.name + " ist weiblich.", "Was nun?");
                        else {
                            var relmap = groupBy(rels, r => r.relname);
                            var answer = member.name + " ist ";
                            answer += arrayToSpeech(Object.keys(relmap), r => arrayToSpeech(relmap[r], m => m.name + "s") + " " + r);
                            this.emit(':askWithCard', answer, "Was nun?", "Anfrage Beziehungen", answer);
                        }
                    });
                }
            });
    }, */
    "AMAZON.CancelIntent": function () {
        cancel.call(this);
    },
    "AMAZON.HelpIntent": function () {
        this.emit(':ask', currentDialogInstructions(), currentDialogInstructions());
    },
    "AMAZON.StopIntent": function () {
        this.emit(':tell', "Auf Wiedersehen");
    }
};

function debug() {
    this.emit(':ask', intent.name + ": " + arrayToSpeech(Object.keys(this.event.request.intent.slots), i=>i+": "+this.event.request.intent.slots[i].value));
}

function handleUnexpectedIntent() {
    this.emit(':ask', "Ich habe dich leider nicht verstanden. " + currentDialogInstructions(), currentDialogInstructions());
}

function cancel() {
    this.attributes.dialogstatus = null;
    this.emit(':tell', "Okay, ich habe abgebrochen.");
}

function currentDialogInstructions() {
    if (this.attributes.dialogstatus == 'addinitial') {
        return "Bitte sage einen Vornamen.";
    } else if (this.attributes.dialogstatus == 'addinitialgender') {
        return "Sage männlich oder weiblich.";
    } else {
        return "Sage zum Beispiel: wer ist Max, oder: wie alt ist David.";
    }
}

function setInitialMember() {
    if (this.attributes.dialogstatus == 'addinitial') {
        var name = this.event.request.intent.slots.name.value;
        this.attributes.dialogstatus = 'addinitialgender';
        this.attributes.currentmember = name;
        this.emit(':ask', "Hallo " + name + ". Ist " + name + " ein männlicher oder ein weiblicher Vorname?", "Sage männlich oder weiblich");
    } else {
        handleUnexpectedIntent();
    }
}

function setInitialMemberGender(gender, genderfull) {
    if (this.attributes.dialogstatus == 'addinitialgender') {
        var name = this.attributes.currentmember;
        this.attributes.dialogstatus = null;
        invokeBackend(BACKEND_URL+'/member', {method: 'POST', body: JSON.stringify({name: name, gender: gender}), headers: {"Content-Type": "application/json"}}).then(body => {
            if (body.error) this.emit(':ask', "Die Person " + body.error + " existiert bereits.", "Was nun?");
            else this.emit(':ask', "Okay, ich habe die " + genderfull + " Person " + name + " hinzugefügt. Füge nun weitere Personen hinzu, indem du zum Beispiel sagst: Füge David hinzu.", "Was nun?");
        });
    } else {
        handleUnexpectedIntent();
    }
}

function setRelationAdding() {
    if (this.attributes.dialogstatus == 'addmember') {
        this.event.request.intent.slots.name_a = {value: this.attributes.currentmember};
        setRelation(false, true);
    } else {
        handleUnexpectedIntent();
    }
}

function setRelation(inverse, adding) {
    var setrel;
    var confirming = false;
    if (this.attributes.dialogstatus == 'confirmsetrelation') {
        this.attributes.dialogstatus = null;
        setrel = this.attributes.currentsetrel;
        confirming = true;
    } else {
        if (!this.event.request.intent.slots.relation.value ||
            !this.event.request.intent.slots.name_a.value ||
            !this.event.request.intent.slots.name_b.value ||
            (this.event.request.intent.slots.name_c && !this.event.request.intent.slots.name_c.value)) {
            handleUnexpectedIntent();
            return;
        }
        var memberrel = {
            member_b: this.event.request.intent.slots.name_b.value,
            relation: this.event.request.intent.slots.relation.value
        };
        if (this.event.request.intent.slots.name_c) memberrel.member_c = this.event.request.intent.slots.name_c.value;
        setrel = {
            member: this.event.request.intent.slots.name_a.value,
            memberrel: memberrel,
            inverse: inverse,
            adding: adding
        };
        this.attributes.dialogstatus = 'confirmsetrelation';
        this.attributes.currentsetrel = setrel;
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
    invokeBackend(BACKEND_URL+'/member/' + setrel.member + "/rel" + queryParams, {method: 'POST', body: JSON.stringify(setrel.memberrel), headers: {"Content-Type": "application/json"}})
        .then(function(body) {
            handleSetRelationResult(body, confirming);
        });
}

function handleSetRelationResult(body, confirming) {
    if (body.error) {
        this.attributes.dialogstatus = null;
        this.emit(':ask', "Ich kenne die Person oder die Bezeichnung " + body.error + " nicht. Um eine neue Person hinzuzufügen, sage zum Beispiel: Füge David hinzu.", "Was nun?");
    } else {
        var answer = body.added ? "Okay, ich " + (confirming ? "habe " : "werde die Person ") + body.member_a + " neu " + (confirming ? "hinzugefügt" : "hinzufügen") + ". " : "Okay, ";
        answer += body.member_a + " ist " + body.member_b + "s ";
        if (body.member_c) answer += "und " + body.member_c + "s "
        answer += body.relation;
        if (body.error_c) answer += ". Die dritte Person " + body.error_c + " habe ich leider nicht gefunden";
        if (!confirming) answer += ". Ist das richtig?";
        this.emit(':askWithCard', answer, "Was nun?", "Setze Beziehung", answer);
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

function invokeBackend(url, options) {
    url += url.indexOf("?")>=0 ? "&" : "?";
    url += "userid=" + this.event.session.user.userId;
    return nodeFetch(url, options)
        .then(function(res) {
            return res.json();
        }).catch(function(err) {
            this.emit(':tellWithCard', "Fehler", "Weltraum-Fehler", "" + JSON.stringify(err));
        });
}
