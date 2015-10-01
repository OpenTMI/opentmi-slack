var _ = require('underscore');
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
    
    var allowAllUsers = true;
    var allowedUsers = [/jussi/, /wirkus/];
    
    var allowAllChannels = false;
    var allowedChannels = [/jussiva/, /wirkus/, /thread/, /6lowpan/, /clitest/];

    var cfg = nconf.get('slack');

	this.register = function(){

        if( !cfg || !cfg.token ) {
            winston.error('slack configuration missing!');
            return;
        }
        
        var slackOpts = {
          token: nconf.get('slack').token,
          autoReconnect: true,
          //autoMark: false
        }
        var slack = new Slack(slackOpts.token, slackOpts.autoReconnect, slackOpts.automark);

        slack
          .on('open', function(){
          channels = []
          groups = []
          unreads = slack.getUnreadCount()
          winston.info('Slack -connection open');
          // Get all the channels that bot is a member of
          /*channels = {} 
          for( var id, channel in slack.channels ) {
             if( channel.is_member ) 
              channels[channel.id] = channel.name;
          }*/
          // Get all groups that are open and not archived 
          //groups = (group.name for id, group of slack.groups when group.is_open and not group.is_archived)
        })
        .on('error', winston.error)
        .on('message', handleMessage);
        slack.login();
    }
    
    var allowedChannel = function(channel) {
        if( allowAllChannels ) return true;
        if( !channel || !channel.name ) return false;
        winston.log('SLACK: check if channel is valid: '+channel.name);
        return allowedChannels.some( function(ch) {
            if( channel.name.toLowerCase().match(ch) ){
                return true;
            }
        });
    }
    var allowedUser = function(user) {
        if( allowAllUsers ) return true;
        if( !user || !user.real_name ) return false;
        winston.log('SLACK: check if user is valid: '+user.real_name);
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
        channel.send("```Test Management Service\n:list testcases\tList all available cases\n:list results\tList 10 latest results\n:run [testcase]\t:run individual case\n:help\tThis help```");
    }
    var list = function(message, channel, user, m) {
        q = {f: 'tcid', t: 'distinct'};
        if( m=message.text.match(/^\:list\Wtestcases\W(.*)/)  ) {
            try {
                _.extend(q, JSON.parse(m[1]));
            } catch(e) {
                console.log(e);
                channel.send('Invalid format');
                return;
            }
        }
        Testcase.query(q, function(error, list){
          channel.send('```'+JSON.stringify(list, ' ', '\n')+'```');
        })
    }
    var results = function(message, channel, user, m) {
        q = {l: 10, s: '{"cre.time": -1}', q: {}};
        if( m=message.text.match(/thread/) || channel.name.match(/thread/) ) {
            if(!q.q['$or']) q.q['$or'] = [];
            q.q['$or'].push({'exec.sut.cut': 'thread'});
        }
        else if( m=message.text.match(/6lowpan/) || channel.name.match(/6lowpan/)  ) {
            if(!q.q['$or']) q.q['$or'] = [];
            q.q['$or'].push({'exec.sut.cut': '6LoWPAN'});
        }
        else if( m=message.text.match(/^\:list\Wresults\W(.*)/)  ) {
            try {
                _.extend(q, JSON.parse(m[1]));
            } catch(e) {
                console.log(e);
                channel.send('Invalid format');
                return;
            }
        }
        q.q = JSON.stringify(q.q);
        console.log('SLACK: result query: '+JSON.stringify(q));
        Result.query(q, function(error, list){
            if( error ) {
                channel.send('Error while query');
                return;
            }
            var str = 'TC\t\tResult\n';
            list.forEach( function (result){
                if( result.exec && result.exec.verdict ) {
                    str += result.tcid+'\t'+result.exec.verdict+'\n';
                }
            });
            channel.send('```'+str+'```');
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
        console.log('SLACK: check if cmd is valid: '+message.text);
        return commands.some( function(cmd) {
            m =  message.text.match(cmd.m);
            if(m) {
                cmd.f(message, channel, user, m);
                return true;
            }
        });
    }
    
    var handleMessage = function(message) {
        try {
            channel = slack.getChannelGroupOrDMByID(message.channel)
            user = slack.getUserByID(message.user)
            if( !allowMessage(channel, user) ) {
                winston.warn('SLACK: message not allowed');
                return;
            }
            if( !user.hasOwnProperty("real_name") ) {
                console.log(user);
                console.log(message.text);
                return;
            }
            winston.log('SLACK: '+channel.name+'|'+user.real_name+''+message.text);
            if( !execute(message, channel, user) ) {
                console('SLACK: Unknown command: '+message.text);
            }
        } catch( e ) {
            console.log(e);
            console.log(message.text);
        }
    }
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
	

  return this;
}

exports = module.exports = AddonSlack;