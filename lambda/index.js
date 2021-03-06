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
                this.attributes.dialogstatus = 'ADDINITIAL';
                this.emit(':ask', "Willkommen bei deiner Familie. Noch sind keine Familienmitglieder vorhanden. " + currentDialogInstructions.call(this), currentDialogInstructions.call(this));
            } else {
                this.attributes.dialogstatus = 'DEFAULT';
                var members = arrayToSpeech(body, m => m.name);
                this.emit(':askWithCard', "Willkommen. Deine Familienmitglieder sind: " + members, "Was nun?", "Weltraum", members);
            }
        });
    },
    "AddInitialMemberIntent": function () {
        if (assertDialogStatusAndState.call(this, 'ADDINITIAL')) {
            // check value of gender: only allow männlich or weiblich
            if (this.event.request.intent.slots.gender.value !== 'weiblich') this.event.request.intent.slots.gender.value = 'männlich';
            if (handleIntentConfirmation.call(this, "Okay, ich werde deine Familie mit der Person "+this.event.request.intent.slots.name.value+" einrichten. "+this.event.request.intent.slots.name.value+" ist eine "+this.event.request.intent.slots.gender.value+"e Person. Ist das richtig?")) {
                setInitialMember.call(this);
            }
        }
    },
    "DeleteMembersIntent": function () {
        if (assertDialogStatusAndState.call(this, 'DEFAULT')) {
            if (handleIntentConfirmation.call(this, 'Soll ich wirklich alle Personen löschen?')) {
                invokeBackend.call(this, BACKEND_URL+'/member', {method: 'DELETE'})
                    .then(body => {
                        this.attributes.dialogstatus = 'ADDINITIAL';
                        this.emit(':ask', "Okay, ich habe alle Personen gelöscht. " + currentDialogInstructions.call(this), currentDialogInstructions.call(this));
                    });
            }
        }
    },
    "ListMembersIntent": function () {
        if (assertDialogStatusAndState.call(this, 'DEFAULT')) {
            invokeBackend.call(this, BACKEND_URL+'/member')
                .then(body => {
                    if (body.length === 0)
                        this.emit(':tell', "Es sind keine Familienmitglieder vorhanden");
                    else {
                        var members = arrayToSpeech(body, m => m.name);
                        this.emit(':askWithCard', "Deine Familienmitglieder sind: " + members, "Was nun?", "Weltraum", members);
                    }
                });
        }
    },
    "AddMemberIntent": function () {
        if (this.attributes.dialogstatus && this.attributes.dialogstatus !== 'DEFAULT') {
            handleUnexpectedIntent.call(this);
        } else if (this.event.request.dialogState !== 'COMPLETED') {
            var intent = this.event.request.intent;
            if (intent.slots.name_a.value) { // name_a set
                // verify existence and abort if the name already exists
                invokeBackend.call(this, BACKEND_URL+'/member/' + intent.slots.name_a.value + "?noFallback=true")
                    .then(body => {
                        if (body.error) this.emit(':delegate'); // go on
                        else this.emit(':tell', "Tut mir leid, die Person " + body.name + " existiert bereits.");
                    });
            } else {
                this.emit(':delegate'); // go on
            }
        } else {
            setRelationAdding.call(this);
        }
    },
    "SetRelationIntent": function () {
        if (assertDialogStatusAndState.call(this, 'DEFAULT')) {
            setRelation.call(this);
        }
    },
    "QueryRelationIntent": function () {
        if (assertDialogStatusAndState.call(this, 'DEFAULT')) {
            invokeBackend.call(this, BACKEND_URL+'/member/' + this.event.request.intent.slots.name.value + "/rel?reverse=true&find=" + this.event.request.intent.slots.relation.value)
                .then(body => {
                    if (body.error) this.emit(':tell', "Ich kenne die Person oder die Bezeichnung " + body.error + " nicht");
                    else {
                        var answer;
                        if (!body.length) answer = "Ich habe " + this.event.request.intent.slots.relation.value + " von " + this.event.request.intent.slots.name.value + " nicht gefunden.";
                        else answer = arrayToSpeech(body, element => element.name);
                        this.emit(':tellWithCard', answer, "Frage Beziehung", this.event.request.intent.slots.relation.value + " von " + this.event.request.intent.slots.name.value + " = " + answer);
                    }
                });
        }
    },
    "QueryMemberRelations": function () {
        if (assertDialogStatusAndState.call(this, 'DEFAULT')) {
            invokeBackend.call(this, BACKEND_URL+'/member/' + this.event.request.intent.slots.name.value)
                .then(member => {
                    if (member.error) this.emit(':tell', "Ich kenne die Person " + member.error + " nicht");
                    else {
                        invokeBackend.call(this, BACKEND_URL+'/member/' + this.event.request.intent.slots.name.value + '/rel?resolveDict=true').then(rels => {
                            if (rels.length === 0) this.emit(':tell', "Du hast noch keine eindeutigen Beziehungsinformationen zu " + member.name + " hinterlegt. Um mir das Geschlecht mitzuteilen, sage zum Beispiel: " + member.name + " ist Davids Sohn oder: " + member.name + " ist Davids Tochter.");
                            else {
                                var relmap = groupBy(rels, r => r.relname);
                                var answer = member.name + " ist ";
                                answer += arrayToSpeech(Object.keys(relmap), r => arrayToSpeech(relmap[r], m => m.name + "s") + " " + r);
                                this.emit(':tellWithCard', answer, "Anfrage Beziehungen", answer);
                            }
                        });
                    }
                });
        }
    },
    "SetDateOfBirthIntent": function () {
        if (assertDialogStatusAndState.call(this, 'DEFAULT')) {
            if (!this.event.request.intent.slots.year || !this.event.request.intent.slots.year.value || this.event.request.intent.slots.year.value.length < 4) {
                this.emit(':tell', "Tut mir leid, das Jahr " + (this.event.request.intent.slots.year ? this.event.request.intent.slots.year.value : "") + " ist ungültig");
            } else if (!this.event.request.intent.slots.birthday || !this.event.request.intent.slots.birthday.value || this.event.request.intent.slots.birthday.value.length != 10) {
                this.emit(':tell', "Tut mir leid, das Datum " + (this.event.request.intent.slots.birthday ? this.event.request.intent.slots.birthday.value : "") + " ist ungültig");
            } else {
                invokeBackend.call(this, BACKEND_URL+'/member/' + this.event.request.intent.slots.name.value + '?set=birthday&value=' + this.event.request.intent.slots.year.value + this.event.request.intent.slots.birthday.value.substr(4))
                    .then(body => {
                        if (body.error) this.emit(':tell', "Ich kenne die Person " + body.error + " nicht");
                        else this.emit(':tellWithCard', "Okay, " + body.name + " wurde am " + body.birthday + " geboren.", "Setze Geburtsdatum", body.name + " = " + body.birthday);
                    });
            }
        }
    },
    "QueryDateOfBirthIntent": function () {
        if (assertDialogStatusAndState.call(this, 'DEFAULT')) {
            invokeBackend.call(this, BACKEND_URL+'/member/' + this.event.request.intent.slots.name.value)
                .then(body => {
                    if (body.error) this.emit(':tell', "Ich kenne die Person " + body.error + " nicht");
                    else if (!body.birthday) this.emit(':tell', "Ich weiß leider nicht, was das Geburtsdatum von " + body.name + " ist.");
                    else this.emit(':tellWithCard', body.name + " wurde am " + body.birthday + " geboren", "Anfrage Geburtsdatum", body.birthday);
                });
        }
    },
    "QueryAgeIntent": function () {
        if (assertDialogStatusAndState.call(this, 'DEFAULT')) {
            invokeBackend.call(this, BACKEND_URL+'/member/' + this.event.request.intent.slots.name.value)
                .then(body => {
                    if (body.error) this.emit(':tell', "Ich kenne die Person " + body.error + " nicht");
                    else if (!body.birthday_age) this.emit(':tell', "Ich weiß leider nicht, was das Geburtsdatum von " + body.name + " ist.");
                    else this.emit(':tellWithCard', body.name + " ist " + body.birthday_age + " Jahre alt", "Anfrage Alter", body.birthday_age);
                });
        }
    },
    "QueryBirthdayIntent": function () {
        if (assertDialogStatusAndState.call(this, 'DEFAULT')) {
            invokeBackend.call(this, BACKEND_URL+'/member/' + this.event.request.intent.slots.name.value)
                .then(body => {
                    if (body.error) this.emit(':tell', "Ich kenne die Person " + body.error + " nicht");
                    else if (!body.birthday_next) this.emit(':tell', "Ich weiß leider nicht, was das Geburtsdatum von " + body.name + " ist.");
                    else this.emit(':tellWithCard', body.name + " wird am " + body.birthday_next + " " + (body.birthday_age+1) + " Jahre alt.", "Anfrage Geburtstag", body.birthday_next);
                });
        }
    },
    "QueryBirthdaysIntent": function () {
        if (assertDialogStatusAndState.call(this, 'DEFAULT')) {
            invokeBackend.call(this, BACKEND_URL+'/member?nextBirthdays=true')
                .then(body => {
                    var nextBirthdays = [];
                    body.forEach(member => {if (member.birthday_next) nextBirthdays.push(member.name + " wird am <say-as interpret-as=\"date\">????" + member.birthday_next.substr(5,2) + member.birthday_next.substr(8) + "</say-as> " + (member.birthday_age+1))});
                    nextBirthdays = nextBirthdays.slice(0,3); // next three available birthdays
                    var resultSpeech = "Die nächsten Geburtstage: " + arrayToSpeech(nextBirthdays, b => b + ",");
                    this.emit(':tellWithCard', resultSpeech, resultSpeech);
                });
        }
    },
    "DeleteMemberIntent": function () {
        if (assertDialogStatusAndState.call(this, 'DEFAULT')) {
            if (handleIntentConfirmation.call(this, "Soll ich die Person " + this.event.request.intent.slots.name.value + " wirklich löschen?")) {
                invokeBackend.call(this, BACKEND_URL+'/member/' + this.event.request.intent.slots.name.value, {method: 'DELETE'})
                    .then(body => {
                        if (body.error) this.emit(':tell', "Tut mir leid, ich kenne die Person " + body.error + " nicht");
                        else this.emit(':tell', "Okay, ich habe " + body.deleted + " gelöscht");
                    });
            }
        }
    },
    "SetMaleIntent": function () {
        if (assertDialogStatusAndState.call(this, 'DEFAULT')) {
            invokeBackend.call(this, BACKEND_URL+'/member/' + this.event.request.intent.slots.name.value + '?set=gender&value=m')
                .then(body => {
                    if (body.error) this.emit(':tell', "Ich kenne die Person " + body.error + " nicht");
                    else this.emit(':tell', "Okay, " + body.name + " ist eine männlich Person.");
                });
        }
    },
    "SetFemaleIntent": function () {
        if (assertDialogStatusAndState.call(this, 'DEFAULT')) {
            invokeBackend.call(this, BACKEND_URL+'/member/' + this.event.request.intent.slots.name.value + '?set=gender&value=f')
                .then(body => {
                    if (body.error) this.emit(':tell', "Ich kenne die Person " + body.error + " nicht");
                    else this.emit(':tell', "Okay, " + body.name + " ist eine weiblich Person.");
                });
        }
    },
    "AMAZON.CancelIntent": function () {
        cancel.call(this);
    },
    "AMAZON.HelpIntent": function () {
        this.emit(':ask', currentDialogInstructions.call(this), currentDialogInstructions.call(this));
    },
    "AMAZON.StopIntent": function () {
        this.emit(':tell', "Auf Wiedersehen");
    }
};

function debug() {
    this.emit(':ask', intent.name + ": " + arrayToSpeech(Object.keys(this.event.request.intent.slots), i=>i+": "+this.event.request.intent.slots[i].value));
}

function handleUnexpectedIntent() {
    this.emit(':ask', "Ich habe dich leider nicht verstanden. " + currentDialogInstructions.call(this), currentDialogInstructions.call(this));
}

function cancel() {
    this.emit(':tell', "Okay, ich habe abgebrochen.");
}

function currentDialogInstructions() {
    if (this.attributes.dialogstatus === 'ADDINITIAL') {
        return "Sage: Familie einrichten, um zu beginnen.";
    } else if (this.attributes.dialogstatus === 'DEFAULT') {
        return "Sage zum Beispiel: wer ist Max, oder: wie alt ist David.";
    } else {
        return "Ich habe dich leider nicht verstanden. Sage Stop, um den Skill zu beenden."
    }
}

function assertDialogStatusAndState(dialogStatus) {
    if (!this.attributes.dialogstatus) this.attributes.dialogstatus = 'DEFAULT';
    if (this.attributes.dialogstatus !== dialogStatus) {
        handleUnexpectedIntent.call(this);
        return false;
    } else if (this.event.request.dialogState !== 'COMPLETED') {
        this.emit(':delegate'); // go on with dialog
        return false;
    }
    return true;
}

function handleIntentConfirmation(confirmationPrompt) {
    if (this.event.request.intent.confirmationStatus === 'NONE') {
        this.emit(':confirmIntent', confirmationPrompt, 'Sag ja oder nein');
        return false;
    } else if (this.event.request.intent.confirmationStatus !== 'CONFIRMED') {
        cancel.call(this);
        return false;
    }
    return true;
}

function setInitialMember() {
    var name = this.event.request.intent.slots.name.value;
    var gender = this.event.request.intent.slots.gender.value;
    this.attributes.dialogstatus = 'DEFAULT';
    invokeBackend.call(this, BACKEND_URL+'/member', {method: 'POST', body: JSON.stringify({name: name, gender: gender.substr(0,1)}), headers: {"Content-Type": "application/json"}}).then(body => {
        if (body.error) this.emit(':ask', "Die Person " + body.error + " existiert bereits.", "Was nun?");
        else this.emit(':ask', "Okay, ich habe die " + gender + "e Person " + name + " hinzugefügt. Füge nun weitere Personen hinzu, indem du zum Beispiel sagst: Füge David hinzu.", "Was nun?");
    });
}

function setRelationAdding() {
    setRelation.call(this, false, true);
}

function setRelation(inverse, adding) {
    var memberrel = {
        member_a: this.event.request.intent.slots.name_a.value,
        member_b: this.event.request.intent.slots.name_b.value,
        member_c: this.event.request.intent.slots.name_c.value,
        relation: this.event.request.intent.slots.relation.value
    };
    var confirming = false;
    if (this.event.request.intent.confirmationStatus === 'CONFIRMED') {
        confirming = true;
    } else if (this.event.request.intent.confirmationStatus === 'DENIED') {
        cancel.call(this);
        return;
    }
    var queryParams = "";
    if (inverse) queryParams += "?inverse=true";
    if (adding) {
        queryParams += queryParams.length ? "&" : "?";
        queryParams += "allowAdding=true";
    }
    if (!confirming) {
        queryParams += queryParams.length ? "&" : "?";
        queryParams += "verify=true";
    }
    invokeBackend.call(this, BACKEND_URL+'/member/' + memberrel.member_a + "/rel" + queryParams, {method: 'POST', body: JSON.stringify(memberrel), headers: {"Content-Type": "application/json"}})
        .then(body => {
            handleSetRelationResult.call(this, body, confirming);
        });
}

function handleSetRelationResult(body, confirming) {
    if (body.error) {
        this.emit(':tell', "Ich kenne die Person oder die Bezeichnung " + body.error + " nicht. Bitte versuche es erneut.");
    } else {
        var answer = body.added ? "Okay, ich " + (confirming ? "habe " : "werde die Person ") + body.member_a + " neu " + (confirming ? "hinzugefügt" : "hinzufügen") + ". " : "Okay, ";
        answer += body.member_a + " ist " + body.member_b + "s ";
        if (body.member_c) answer += "und " + body.member_c + "s "
        answer += body.relation;
        if (body.error_c) answer += ". Die dritte Person " + body.error_c + " habe ich leider nicht gefunden";
        if (!confirming) answer += ". Ist das richtig?";
        if (confirming) this.emit(':tellWithCard', answer, "Setze Beziehung", answer);
        else this.emit(':confirmIntent', answer, answer);
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
        .then(res => res.json())
        .catch(err => {
            this.emit(':tellWithCard', "Fehler", "Weltraum-Fehler", "" + JSON.stringify(err));
        });
}
