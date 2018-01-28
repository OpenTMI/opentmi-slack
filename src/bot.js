const Promise = require('bluebird');
const _ = require('lodash');
const parse = require("json-templates");


class Bot {
  constructor({chat, logger, eventBus, config, models}) {
    this.logger = logger;
    this._chat = chat;
    this._eventBus = eventBus;
    this._config = config;
    this.Testcase = _.get(models, 'Testcase');
    this.Result = _.get(models, 'Result');
    this._onMessage = this._onMessage.bind(this);
    this._onNewResult = this._onNewResult.bind(this);
  }

  start() {
    this._chat.on('message:received', this._onMessage);
    this._eventBus.on('result.new', this._onNewResult);
    return Promise.resolve();
  }
  close() {
    this._chat.removeListener('message:received', this._onMessage);
    this._eventBus.removeListener('result.new', this._onNewResult);
  }

  get newResultTemplateStr() {
    const defaultTemplate = 'New test result for {{tcid}} : {{exec.verdict}} ({{exec.note}})';
    return _.get(this._config, 'result.template', defaultTemplate);
  }
  get newResultFilter() {
    return _.get(this._config, 'result.filter', {exec: {verdict: 'inconc'}});
  }
  get allowAllChannels() {
    return _.get(this._config, 'filters.allowAllChannels', false);
  }
  get allowedChannels() {
    return _.get(this._config, 'filters.allowedChannels', []);
  }
  get allowAllUsers() {
    return _.get(this._config, 'filters.allowAllUsers', false);
  }
  get allowedUsers() {
    return _.get(this._config, 'filters.allowedUsers', []);
  }

  allowedUser({user}) {
    if (this.allowAllUsers) return true;
    if (!user || !user.real_name) return false;
    this.logger.silly('SLACK: check if user is valid: ' + user.real_name);
    return this.allowedUsers.some((usr) =>
      user.real_name.toLowerCase().match(usr)
    );
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


  _onNewResult(result) {
    const match = _.isMatch(result, this.newResultFilter);
    if (!match) {
      this.logger.silly('new result did not match to preconditions');
      return;
    }
    const template = parse(this.newResultTemplateStr);
    const data = {
      text: template(result)
    };
    this._chat.emit('message:send', data);
  }

  _onMessage(message) {
    if(!this.filter(message)) return;
    // @todo these could be much better
    this._handleMessage(message);
  }

  _status(message) {
    return Promise.try(() => {
      message.reply(`Still alive - ${Math.round(process.uptime()/60)}min`);
    });
  }

  static _help(message) {
    return Promise.try(() => {
      const msg = "```OpenTMI BOT commands:\n" +
        ":list testcases\tList all available cases\n" +
        ":list results\tList 10 latest results\n" +
        ":run [testcase]\t" +
        ":run individual case\n" +
        ":status\tOpenTMI status\n" +
        ":help\tThis help```";
      message.reply(msg);
    });
  }
  _listTest(message) {
    return Promise.try(() => {
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
    })
  }
  _listResults(message) {
    return Promise.try(() => {
      const q = {l: 10, s: '{"cre.time": -1}', q: {}};
      let m = message.text.match(/cut=(.*)/);
      if (m) {
        if(!q.q['$or']) q.q['$or'] = [];
        q.q['$or'].push({'exec.sut.cut': m[1]});
      }
      m = message.text.match(/^q=\{(.*)\}$/);
      if (m) {
        try {
          _.extend(q, JSON.parse(m[1]));
        } catch (error) {
          this.logger.warn(error);
          message.reply(`Invalid format: ${error}`);
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
    });
  }
  _handleMessage(message) {
    const commands = [
      {m: /^:help/, f: Bot._help.bind(this)},
      {m: /^:status/, f: this._status.bind(this)},
      {m: /^:list\Wtestcases/, f: this._listTest.bind(this)},
      {m: /^:list\Wresults/, f: this._listResults.bind(this)},
      // {m: /^\:run\W(.*)/, f: run}
      {m: /.*/, f: Promise.reject.bind('Command not found')}
    ];
    if (!message.text.match(/^:/)) {
      this.logger.silly('SLACK: msg not started with ":"');
      return;
    }
    this.logger.silly('SLACK: check if cmd is valid: ' + message.text);
    const command = commands.find(cmd => message.text.match(cmd.m));
    command.f(message, message.text.match(command.m))
      .catch(error => {
        this.logger.error(error);
        message.reply(`Error: ${error}`);
      })
  }
}

module.exports = Bot;