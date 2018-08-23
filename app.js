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

var tableName = 'botdata';
var azureTableClient = new botbuilder_azure.AzureTableClient(tableName, process.env['AzureWebJobsStorage']);
//Comment the line below when running locally. Uncomment the line below when publishing to Azure
// var tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);
//Comment the line below when publishing to Azure. Uncomment the line below when running locally.
var tableStorage = new builder.MemoryBotStorage();

// Create your bot with a function to receive messages from the user
var bot = new builder.UniversalBot(connector);
bot.set('storage', tableStorage);

var triviaOptions = {
    url: 'https://opentdb.com/api.php?amount=1&difficulty=hard&type=multiple',
    headers: {
        'Content-Type': 'application/json'
    }
}

bot.dialog('/', [
    function (session) {
        session.conversationData.questionCount = 1;
        session.conversationData.correctCount = 0;
        session.send('Welcome to Bot Trivia!');
        session.send('Enter /end to end the game at any time.');
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
            session.conversationData.correctCount++;
        } else {
            session.send(`That\'s incorrect! The correct answer was ${session.conversationData.correctAnswer}.`);
        }
        session.send(`Score: ${session.conversationData.correctCount} / ${session.conversationData.questionCount - 1}`);
        session.replaceDialog('questionContainer');
    }
]).endConversationAction('endConversationAction', 'Thank you for playing Bot Trivia!', {
    matches: /^\/end$/i
});
bot.dialog('question', [
    function (session) {
        var item = {};
        request.post(triviaOptions, function (err, res, body) {
            var parsedBody = JSON.parse(body);
            item.question = parsedBody.results[0].question;
            session.conversationData.correctAnswer = parsedBody.results[0].correct_answer;
            item.answers = parsedBody.results[0].incorrect_answers;
            item.answers.splice(Math.floor(Math.random() * 3), 0, session.conversationData.correctAnswer);
            builder.Prompts.choice(session, `Question #${session.conversationData.questionCount}: ${item.question}`, item.answers);
            session.conversationData.questionCount++;
        });
    },
    function (session, results) {
        session.endDialogWithResult(results);
    }
]).endConversationAction('endConversationAction', 'Thank you for playing Bot Trivia!', {
    matches: /^\/end$/i
});