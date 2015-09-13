var mongoose = require('mongoose');
var Slack = require('slack-client');
    
function AddonSlack (app, server, io, passport){
  var self = this;
	this.name = 'Slack';
	this.description = 'Just an very simple Example';
  this.listDependencies = ['slack-robot'];
  var Testcase = mongoose.model('Testcase')

	this.register = function(){
    
    
    var slackOpts = {
      token: 'xoxp-2987443183-9694241206-10619586020-44aa8be661',
      //token: process.env.SLACK_TOKEN // required
      autoReconnect: true,
      //autoMark: false
    }

    var slack = new Slack(slackOpts.token, slackOpts.autoReconnect, slackOpts.automark);

    slack
      .on('open', function(){
      channels = []
      groups = []
      unreads = slack.getUnreadCount()

      // Get all the channels that bot is a member of
      /*channels = {} 
      for( var id, channel in slack.channels ) {
         if( channel.is_member ) 
          channels[channel.id] = channel.name;
      }*/
      // Get all groups that are open and not archived 
      //groups = (group.name for id, group of slack.groups when group.is_open and not group.is_archived)
    })
    .on('message', function(message){
      channel = slack.getChannelGroupOrDMByID(message.channel)
      user = slack.getUserByID(message.user)

      console.log(channel.name);
      console.log(user.real_name);
      console.log(message.text);
      if( message.text.match(/list/)) {
        Testcase.query({t: 'distinct', f: 'tcid'}, function(error, list){
          console.log(list);
          channel.send(JSON.stringify(list, ' ', '\n'));
        })
      } else if(m=message.text.match(/run (.*)/)) {
        channel.send('Starting execute TC: '+m[1]+'...');
      }
    });
    slack.login();
    /*
    var robotOpts = {
      ignoreMessageInGeneral: true,
      //mentionToRespond: true,
      //skipDMMention: false
    }
    var robot = new Robot(slackOpts, robotOpts);
    
    robot.listen('hello') //:results([a-z\-]+)
      .handler(function(req, res) {
      // you can get named-param inside Request object
      console.log(req.param);
      console.log("hello received");
      res.sendText("Hi There");
      // {animal: 'sheep', year: '2010'}  
      // note that req.param always returns Map<string, string>
    });

    app.get('/api/v0/slack', function(req, res){
		  res.json({ok: 1});
		});*/
	}

  return this;
}

exports = module.exports = AddonSlack;