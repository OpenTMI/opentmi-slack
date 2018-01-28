// 3rd party modules
const _ = require('lodash');
const nconf = require('nconf');
const {singleton, Addon} = require('opentmi-addon');

const Slack = require('./slack');
const Bot = require('./bot');

class AddonSlack extends Addon {
  constructor(...args) {
    super(...args);

    this.name = 'Slack';
    this.description = 'Slack integration addon';
    this._slackCfg = nconf.get('slack');
  }
  register() {
    if( !_.get(this._slackCfg, 'token') ) {
        this.logger.error('slack configuration missing!');
        return Promise.reject('slack configuration missing');
    }
    this._slack = new Slack();

    this._slack.login(this._slackCfg);
    this._messageHandler = new Bot({bus: this._slack, logger: this.logger});
    return;

  unregister() {

  }
}

module.exports = singleton(AddonSlack);
