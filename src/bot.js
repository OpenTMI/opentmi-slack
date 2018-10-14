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
    this._commands = [];
    this._onMessage = this._onMessage.bind(this);
    this._onNewResult = this._onNewResult.bind(this);
    this._registerCommands();
  }
  _registerCommands() {
    this._addCommand(/^tmi:help/, Bot._help.bind(this));
    this._addCommand(/^tmi:status/, Bot._status);
    this._addCommand(/^tmi:list\Wtestcases/, this._listTest.bind(this));
    this._addCommand(/^tmi:list\Wresults/, this._listResults.bind(this));
    //this._addCommand(/^\:run\W(.*)/, run);
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

  resultTemplate(name) {
    let defaultTemplate = '';
    switch (name) {
      case('new'):
        defaultTemplate = 'New test result for {{tcid}} : {{exec.verdict}} ({{exec.note}})';
        break;
      default: break;
    }
    return _.get(this._config, `result.templates.${name}`, defaultTemplate);
  }

  get newResultTemplateStr() {
    return this.resultTemplate('new');
  }
  resultFilter(name) {
    let defaultFilter = {};
    switch (name) {
      case('inconclusive'):
        defaultFilter = {exec: {verdict: 'inconclusive'}};
        break;
      case('new'):
        return this.resultFilter('inconclusive');
      case('hw'):
        defaultFilter = {exec: {dut: {type: 'hw'}}};
        break;
      default:
        break;
    }
    return _.get(this._config, `result.filters.${name}`, defaultFilter);
  }
  get newResultFilter() {
    return this.resultFilter('new');
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
    return _.some(this.allowedUsers, (usr) => {
      const re = new RegExp(usr, 'i');
      return re.test(user.real_name)
    });
  }
  allowedChannel({channel}) {
    if (this.allowAllChannels) return true;
    this.logger.silly('SLACK: check if channel is valid: ' + channel.name);
    return _.some(this.allowedChannels, (ch) => {
      const re = new RegExp(ch, 'i');
      return re.test(channel.name);
    });
  }
  filter(message) {
    return this.allowedChannel(message) && this.allowedUser(message);
  }

  _onNewResult(bus, result) {
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
    this._handleMessage(message);
  }

  static _status(message) {
    return Promise.try(() => {
      message.reply(`Still alive - ${Math.round(process.uptime()/60)}min`);
    });
  }

  static _help(message) {
    return Promise.try(() => {
      const msg = "```OpenTMI BOT commands:\n" +
        "tmi:<commands>\tformat\n" +
        "Commands:\n" +
        "list testcases\tList all available cases\n" +
        "list results\tList 10 latest results\n" +
        "run [testcase]\t" +
        "run individual case\n" +
        "status\tOpenTMI status\n" +
        "help\tThis help```";
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

      let m = message.text.match(/filters=(.*)/);
      if (m) {
        m[1].split(',').forEach((filter) => {
          _.merge(q.q, this.resultFilter(filter));
        });
      }
      m = message.text.match(/cut=(.*)/);
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
  _addCommand(match, cb, help, man) {
    this._commands.push({m: match, f: cb, help, man});
  }
  _handleMessage(message) {
    const commands = [...this._commands,
      {m: /.*/, f: ({text}) => Promise.reject(new Error(`Command ${text} not found`))}
    ];
    if (!message.text.match(/^tmi:/)) {
      //this.logger.silly('SLACK: msg not started with "tmi:"');
      return;
    }
    this.logger.silly('SLACK: check if cmd is valid: ' + message.text);
    const command = commands.find(cmd => message.text.match(cmd.m));
    command.f(message, message.text.match(command.m))
      .catch(error => {
        this.logger.warn(`Command rejection: ${error}`);
        message.reply(`Error: ${error}`);
      })
  }
}

module.exports = Bot;
