// 3rd party modules
const mongoose = require('mongoose');
const _ = require('lodash');
const {singleton, Addon} = require('opentmi-addon');

const Slack = require('./slack');
const Bot = require('./bot');

class AddonSlack extends Addon {
  constructor(...args) {
    super(...args);
    this._name = 'Slack';
    this.description = 'Slack integration addon';
  }
  register() {
    const config = this.settings;
    const token = _.get(config, 'token');
    if (!token) {
      this.logger.error('slack configuration missing!');
      return Promise.reject(new Error('slack configuration missing'));
    }
    const options = {
      logger: this.logger,
      defaultChannel: _.get(config, 'defaultChannel')
    };
    this._slack = new Slack(options);
    this._slack.login(token);
    const models = {
      Result: mongoose.model('Result'),
      Testcase: mongoose.model('Testcase')
    };
    this._bot = new Bot({
      chat: this._slack,
      logger: this.logger,
      eventBus: this.eventBus,
      config,
      models
    });
    return this._bot.start();
  }
  unregister() {
    this._slack.logout();
    this._bot.close();
  }
}


module.exports = singleton(AddonSlack);
