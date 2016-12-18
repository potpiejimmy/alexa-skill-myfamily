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
 * HelloWorld is a child of AlexaSkill.
 * To read more about inheritance in JavaScript, see the link below.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Introduction_to_Object-Oriented_JavaScript#Inheritance
 */
var HelloWorld = function () {
    AlexaSkill.call(this, APP_ID);
};

// Extend AlexaSkill
HelloWorld.prototype = Object.create(AlexaSkill.prototype);
HelloWorld.prototype.constructor = HelloWorld;

HelloWorld.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session) {
    console.log("HelloWorld onSessionStarted requestId: " + sessionStartedRequest.requestId
        + ", sessionId: " + session.sessionId);
    // any initialization logic goes here
};

HelloWorld.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
    console.log("HelloWorld onLaunch requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId);
    var speechOutput = "Willkommen bei deiner Familie. Sag hallo.";
    var repromptText = "Sag hallo.";
    response.ask(speechOutput, repromptText);
};

HelloWorld.prototype.eventHandlers.onSessionEnded = function (sessionEndedRequest, session) {
    console.log("HelloWorld onSessionEnded requestId: " + sessionEndedRequest.requestId
        + ", sessionId: " + session.sessionId);
    // any cleanup logic goes here
};

HelloWorld.prototype.intentHandlers = {
    // register custom intent handlers
    "HelloWorldIntent": function (intent, session, response) {
        response.tellWithCard("Hallo Enya, hallo Julian, hallo Mama und Papa.", "Hallo Familie Liese", "Hallo Familie Liese");
    },
    "GreetEnyaIntent": function (intent, session, response) {
        response.tellWithCard("Hallo Enya Sophia, wie geht es dir?", "Hallo Enya", "Hallo Enya, wie geht es dir?");
    },
    "FetchDataIntent": function (intent, session, response) {
        nodeFetch('http://doogetha.com/buildtool/res/jobs/w7-deffm0368')
            .then(function(res) {
                return res.json();
            }).then(function(body) {
                var jobName = body[0].name;
                response.tellWithCard(jobName, "Weltraum", jobName);
            }).catch(function(err) {
                response.tellWithCard("Fehler", "Weltraum-Fehler", "" + JSON.stringify(err));
            });
    },
    "AMAZON.HelpIntent": function (intent, session, response) {
        response.ask("Sag hallo.", "Sag hallo.");
    }
};

// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context) {
    // Create an instance of the HelloWorld skill.
    var helloWorld = new HelloWorld();
    helloWorld.execute(event, context);
};
