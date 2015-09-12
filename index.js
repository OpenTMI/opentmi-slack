var slack = require('slack');

function AddonSlack (app, server, io, passport){

	this.name = 'Slack';
	this.description = 'Just an very simple Example';


	this.register = function(){
		app.get('/test', function(req, res){
		  res.json({ok: 1});
		});
	}





  return this;
}

exports = module.exports = AddonSlack;