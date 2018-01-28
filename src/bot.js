const mongoose = require('mongoose');
const _ = require('lodash');

class Bot {
  constructor({bus, logger}) {
    this.logger = logger;
    this._bus = bus;

    // @todo these should be configurable
    this.allowAllChannels = false;
    this.allowedChannels = ['jussiva-testestests'];
    this.allowAllChannels = false;
    this.allowedUsers = ['Jussi Vatjus-Anttila'];
    this.botChannel = '';

    this._bus.on('message:received', this._onMessage.bind(this));
    this.Testcase = '';//mongoose.model('Testcase');
    this.Result = '';//mongoose.model('Result');
  }

  allowedUser({user}) {
    if (this.allowAllUsers) return true;
    if (!user || !user.real_name) return false;
    this.logger.silly('SLACK: check if user is valid: ' + user.real_name);
    return this.allowedUsers.some((usr) => {
      if (user.real_name.toLowerCase().match(usr)) {
        return true;
      }
    });
  }
  allowedChannel({channel}) {
    if (this.allowAllChannels) return true;
    this.logger.silly('SLACK: check if channel is valid: ' + channel.name);
    return this.allowedChannels.some((ch) =>
      channel.name.toLowerCase().match(ch));
  }
  filter(message) {
    return this.allowedChannel(message) &&
    !this.allowedUser(message);
  }

  _onMessage(message) {
    if(!this.filter(message)) return;
    this._handleMessage(message);
  }

  static _help(message) {
    const msg = "```OpenTMI BOT commands:\n" +
      ":list testcases\tList all available cases\n" +
      ":list results\tList 10 latest results\n" +
      ":run [testcase]\t" +
      ":run individual case\n" +
      ":help\tThis help```";
    message.reply(msg);
  }
  _listTest(message) {
    const q = {f: 'tcid', t: 'distinct'};
    let m = message.text.match(/^:list\Wtestcases\W(.*)/);
    if (m) {
      try {
        _.extend(q, JSON.parse(m[1]));
      } catch(error) {
        this.logger.warn(error);
        message.reply(`Error: Invalid format: ${error}`);
        return;
      }
    }
    this.Testcase.query(q, function(error, list){
      message.reply('```'+JSON.stringify(list, ' ', '\n')+'```');
    });
  }
  _listResults(message) {
    const q = {l: 10, s: '{"cre.time": -1}', q: {}};
    let m = message.text.match(/cut=(.*)/);
    if (m) {
      if(!q.q['$or']) q.q['$or'] = [];
      q.q['$or'].push({'exec.sut.cut': m[1]});
    }
    m = message.text.match(/^q=\{(.*)\}/);
    if (m) {
      try {
        _.extend(q, JSON.parse(m[1]));
      } catch (error) {
        this.logger.warn(error);
        message.reply('Invalid format');
        return;
      }
    }
    q.q = JSON.stringify(q.q);
    this.logger.silly('SLACK: result query: '+JSON.stringify(q));
    this.Result.query(q, function(error, list){
      if( error ) {
        message.reply('Error while query');
        return;
      }
      let str = 'TC\t\tResult\n';
      list.forEach( function (result){
        if( result.exec && result.exec.verdict ) {
          str += result.tcid+'\t'+result.exec.verdict+'\n';
        }
      });
      message.reply('```'+str+'```');
    })
  }
  _handleMessage(message) {
    const commands = [
      {m: /^:help/, f: Bot._help.bind(this)},
      {m: /^:list\Wtestcases/, f: this._listTest.bind(this)},
      {m: /^:list\Wresults/, f: this._listResults.bind(this)},
      // {m: /^\:run\W(.*)/, f: run}
    ];
    if (!message.text.match(/^:/)) {
      return;
    }
    this.logger.silly('SLACK: check if cmd is valid: ' + message.text);
    commands.some((cmd) => {
      const m = message.text.match(cmd.m);
      if (m) {
        cmd.f(message, m);
        return true;
      } return false;
    });
  }
}

module.exports = Bot;