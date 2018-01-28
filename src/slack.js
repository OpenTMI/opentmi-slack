// native modules
const {EventEmitter} = require('events');

// 3rd party modules
const Promise = require('bluebird');
const invariant = require('invariant');
const _ = require('lodash');
const { RtmClient, CLIENT_EVENTS, RTM_EVENTS, WebClient } = require('@slack/client');

class SlackWrapper extends EventEmitter {
  constructor({logger}) {
    super();
    this.logger = logger;
    this.on('message:send', this._send.bind(this));
  }
  _send({channel, text}) {
    return this.rtm.sendMessage(text, channel.id)
        // Returns a promise that resolves when the message is sent
        .then(() => this.logger.debug(`Message sent to channel ${channel.name}`))
        .catch((error => {
          this.logger.warn(error);
        }));
  }
  login(token) {
      this.rtm = new RtmClient(token, {
        dataStore: false,
        useRtmConnect: true,
      });
      // Need a web client to find a channel where the app can post a message
      this.web = new WebClient(token);
      this.rtm.on(RTM_EVENTS.MESSAGE, this._onMessage.bind(this));
      this.rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, this._rtmConnectionOpen.bind(this));
      this.rtm.on(CLIENT_EVENTS.RTM.DISCONNECT, this._disconnect.bind(this));
      // Load the current channels list asynchrously
      this.channels().then((channels) => {
        const names = SlackWrapper.channelNames(channels);
        this._channels = channels;
        this.logger.silly(`bot is member of channels: ${names.join(', ')}`);
        this.emit('channels', channels);
      });

      this.rtm.start();
  }
  static channelNames(channels) {
    return _.map(channels, ch => ch.name)
  }
  getChannel(id) {
    return this.web.channels.info(id)
      .then(resp => resp.channel);
  }
  getUser(id) {
    return this.web.users.info(id)
      .then(resp => resp.user);
  }
  channels() {
    invariant(this.web, 'not logged in');
    return this.web.channels.list()
      .then(res => res.channels.filter(c => c.is_member));

  }
  logout() {
    invariant(this.web, 'not logged in');
    this.rtm.logout();
  }
  _disconnect() {
    this.logger.warn('Slack connection lost');
  }
  _rtmConnectionOpen() {
    this.logger.debug(`Slack connection ready`);
  }
  _onMessage(message) {

    const channel = this.getChannel(message.channel);
    const user = this.getUser(message.user);
    return Promise
      .all([channel, user])
      .then(([channel, user]) => {
        message.channel = channel;
        message.user = user;
        message.reply = (text) => {
          this.logger.silly('replying: ', text);
          this.emit('message:send', {channel, text});
        };
        this.logger.silly(`Slack msg from ${message.channel.name}#${message.user.name}: ${message.text}`);
        this.emit('message:received', message);
      });
  }
}

module.exports = SlackWrapper;