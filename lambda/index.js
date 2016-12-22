/**
 * App ID for the skill
 */
var APP_ID = 'amzn1.ask.skill.a011a313-560a-42fc-a514-9fcdc5ce5ef8';

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
    var speechOutput = "Willkommen bei deiner Familie. Sag hallo.";
    var repromptText = "Sag hallo.";
    response.ask(speechOutput, repromptText);
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
    "SayHelloIntent": function (intent, session, response) {
        response.askWithCard("Hallo Familie Liese.", "Was nun?", "Hallo Familie Liese", "Hallo Familie Liese");
    },
    "ListMembersIntent": function (intent, session, response) {
        nodeFetch('http://sample-env.7gnri5qkiv.eu-west-1.elasticbeanstalk.com/member')
            .then(function(res) {
                return res.json();
            }).then(function(body) {
                if (body.length === 0)
                    response.ask("Es sind keine Familienmitglieder vorhanden", "Was nun?");
                else {
                    var members = "";
                    body.forEach(m => {
                        if (members.length > 0) members += ", ";
                        members += m.name;
                    })
                    response.askWithCard("Deine Familienmitglieder sind: " + members, "Was nun?", "Weltraum", members);
                }
            }).catch(function(err) {
                response.tellWithCard("Fehler", "Weltraum-Fehler", "" + JSON.stringify(err));
            });
    },
    "AddMemberIntent": function (intent, session, response) {
        nodeFetch('http://sample-env.7gnri5qkiv.eu-west-1.elasticbeanstalk.com/member', {method: 'POST', body: JSON.stringify({name: intent.slots.name.value}), headers: {"Content-Type": "application/json"}})
            .then(function(res) {
                return res.json();
            }).then(function(body) {
                response.ask("Okay", "Was nun?");
            }).catch(function(err) {
                response.tellWithCard("Fehler", "Weltraum-Fehler", "" + JSON.stringify(err));
            });
    },
    "DeleteMembersIntent": function (intent, session, response) {
        nodeFetch('http://sample-env.7gnri5qkiv.eu-west-1.elasticbeanstalk.com/member', {method: 'DELETE'})
            .then(function(res) {
                return res.json();
            }).then(function(body) {
                response.ask("Okay", "Was nun?");
            }).catch(function(err) {
                response.tellWithCard("Fehler", "Weltraum-Fehler", "" + JSON.stringify(err));
            });
    },
    "SetBirthdayIntent": function (intent, session, response) {
        nodeFetch('http://sample-env.7gnri5qkiv.eu-west-1.elasticbeanstalk.com/member/' + intent.slots.name.value + '?set=birthday&value=' + intent.slots.birthday.value)
            .then(function(res) {
                return res.json();
            }).then(function(body) {
                response.ask("Okay", "Was nun?");
            }).catch(function(err) {
                response.tellWithCard("Fehler", "Weltraum-Fehler", "" + JSON.stringify(err));
            });
    },
    "QueryBirthdayIntent": function (intent, session, response) {
        nodeFetch('http://sample-env.7gnri5qkiv.eu-west-1.elasticbeanstalk.com/member/' + intent.slots.name.value)
            .then(function(res) {
                return res.json();
            }).then(function(body) {
                response.askWithCard(body.name + " hat am " + body.birthday + " geburtstag", "Was nun?", "Geburtstagsanfrage", body.birthday);
            }).catch(function(err) {
                response.tellWithCard("Fehler", "Weltraum-Fehler", "" + JSON.stringify(err));
            });
    },
    "QuitIntent": function (intent, session, response) {
        response.tell("Auf Wiedersehen");
    },
    "AMAZON.HelpIntent": function (intent, session, response) {
        response.ask("Sag hallo.", "Sag hallo.");
    }
};

// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context) {
    // Create an instance of the MyFamily skill.
    var myFamily = new MyFamily();
    myFamily.execute(event, context);
};
