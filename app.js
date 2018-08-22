/*-----------------------------------------------------------------------------
A simple echo bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/

var restify = require('restify');
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");
var request = require('request');

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata 
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

/*----------------------------------------------------------------------------------------
* Bot Storage: This is a great spot to register the private state storage for your bot. 
* We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
* For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
* ---------------------------------------------------------------------------------------- */

var tableName = 'botdata';
var azureTableClient = new botbuilder_azure.AzureTableClient(tableName, process.env['AzureWebJobsStorage']);
// var tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);
var tableStorage = new builder.MemoryBotStorage();

// Create your bot with a function to receive messages from the user
var bot = new builder.UniversalBot(connector);
bot.set('storage', tableStorage);

// bot.dialog('/', [
//     function (session) {
//         builder.Prompts.text(session, "Hello... What's your name?");
//     },
//     function (session, results) {
//         session.userData.name = results.response;
//         builder.Prompts.number(session, "Hi " + results.response + ", How many years have you been coding?"); 
//     },
//     function (session, results) {
//         session.userData.coding = results.response;
//         builder.Prompts.choice(session, "What language do you code Node using?", ["JavaScript", "CoffeeScript", "TypeScript"]);
//     },
//     function (session, results) {
//         session.userData.language = results.response.entity;
//         session.send("Got it... " + session.userData.name + 
//                     " you've been programming for " + session.userData.coding + 
//                     " years and use " + session.userData.language + ".");
//     }
// ]);

var triviaOptions = {
    url: 'https://opentdb.com/api.php?amount=1&difficulty=hard&type=multiple',
    headers: {
        'Content-Type': 'application/json'
    }
}

bot.dialog('/', [
    function (session) {
        session.conversationData.questionCount = 1;
        session.send('Welcome to Bot Trivia!');
        session.beginDialog('questionContainer');
    }
]);
bot.dialog('questionContainer', [
    function (session) {
        session.beginDialog('question');
    },
    function (session, results) {
        var answer = results.response.entity;
        if (answer == session.conversationData.correctAnswer) {
            session.send('That\'s correct!');
        } else {
            session.send(`That\'s not correct! The correct answer was ${session.conversationData.correctAnswer}`);
        }
        session.replaceDialog('questionContainer');
    }
]);
bot.dialog('question', [
    function (session) {
        var item = {};
        request.post(triviaOptions, function (err, res, body) {
            var parsedBody = JSON.parse(body);
            item.question = parsedBody.results[0].question;
            session.conversationData.correctAnswer = parsedBody.results[0].correct_answer;
            item.answers = parsedBody.results[0].incorrect_answers;
            item.answers.splice(Math.floor(Math.random() * 3), 0, session.conversationData.correctAnswer);
            session.send(`Question #${session.conversationData.questionCount}:`);
            session.conversationData.questionCount++;
            builder.Prompts.choice(session, item.question, item.answers);
        });
    },
    function (session, results) {
        session.endDialogWithResult(results);
    }
]);

bot.on('conversationUpdate', function (message) {
    if (message.membersAdded) {
        message.membersAdded.forEach(function (identity) {
            if (identity.id === message.address.bot.id) {
                bot.beginDialog(message.address, '/');
            }
        });
    }
});