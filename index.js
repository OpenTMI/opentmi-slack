var winston = require('winston');
var mongoose = require('mongoose');
var Slack = require('slack-client');
var nconf = require('nconf');
var winston = require('winston');
    
function AddonSlack (app, server, io, passport){
  var self = this;
	this.name = 'Slack';
	this.description = 'Slack integration addon';
  this.listDependencies = ['slack-robot'];
  var Testcase = mongoose.model('Testcase')
  var Result = mongoose.model('Result');

  if( !nconf.get('slack')) {
    winston.error('slack configuration missing!');
    nconf.set('slack', {
      token: 'xoxp-2987443183-9694241206-10619586020-44aa8be661'
    })
  }

	this.register = function(){
    console.log('skip slack addon for now');
    return;
    var slackOpts = {
      token: nconf.get('slack').token,
      autoReconnect: true,
      //autoMark: false
    }
    
    var allowedChannel = function(channel) {
        var allowedChannels = [/jussiva/, /wirkus/, /thread/, /6lowpan/];
        if( !channel || !channel.name ) return false;
        winston.log('check if channel is valid: '+channel.name);
        return allowedChannels.some( function(ch) {
            if( channel.name.toLowerCase().match(ch) ){
                return true;
            }
        });
    }
    var allowedUser = function(user) {
        return true; //allow any user to use this for now..
        
        var allowedUsers = [/jussi/, /wirkus/];
        if( !user || !user.real_name ) return false;
        winston.log('check if user is valid: '+user.real_name);
        return allowedUsers.some( function(usr) {
            if( user.real_name.toLowerCase().match(usr) ){
                return true;
            }
        });
    }
    
    var allowMessage = function(channel, user) {
        if( !allowedChannel(channel) ) return false;
        if( !allowedUser(user) ) return false;
        return true;
    }
    
    var help = function(message, channel, user, m) {
        channel.send("Test Management Service\nlist testcases\tList all available cases\nlist results\tList 10 latest results\nrun [testcase]\trun individual case");
    }
    var list = function(message, channel, user, m) {
         Testcase.query({t: 'distinct', f: 'tcid'}, function(error, list){
          channel.send(JSON.stringify(list, ' ', '\n'));
        })
    }
    var results = function(message, channel, user, m) {
        q = {};
        if( m=message.text.match(/thread/) ) {
            if(!q['$or']) q['$or'] = [];
            q['$or'].push({'exec.sut.cut': 'thread'});
        }
        if( m=message.text.match(/6lowpan/) ) {
            if(!q['$or']) q['$or'] = [];
            q['$or'].push({'exec.sut.cut': '6LoWPAN'});
        }
        console.log('result query: '+JSON.stringify(q));
        Result.query({l: 10, s: '{"cre.time": -1}', q: JSON.stringify(q)}, function(error, list){
          var str = 'TC\tResult\n';
          list.forEach( function (result){
            if( result.exec && result.exec.verdict ) {
                str += result.tcid+'\t'+result.exec.verdict+'\n';
            }
          });
          channel.send(str);
        })
    }
    var run = function(message, channel, user, m) {
        channel.send('Starting execute TC: '+m[1]+'...');
    }
    
    var commands = [
        { m: /^\:help/, f: help },
        { m: /^\:list\Wtestcases/, f: list},
        { m: /^\:list\Wresults/, f: results },
        { m: /^\:run\W(.*)/, f: run }
    ]
    
    var execute = function(message, channel, user) {
        if( !message.text.match(/^\:/) ) return false;
        console.log('check if cmd is valid: '+message.text);
        return commands.some( function(cmd) {
            m =  message.text.match(cmd.m);
            if(m) {
                cmd.f(message, channel, user, m);
                return true;
            }
        });
    }
    
    var handleMessage = function(message) {
        channel = slack.getChannelGroupOrDMByID(message.channel)
        user = slack.getUserByID(message.user)
        if( !allowMessage(channel, user) ) {
            winston.warn('message not allowed');
            return;
        }
        winston.log('SLACK: '+channel.name+'|'+user.real_name+''+message.text);
        if( !execute(message, channel, user) ) {
            channel.send('Unknown command');
        }
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
    .on('message', handleMessage);
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