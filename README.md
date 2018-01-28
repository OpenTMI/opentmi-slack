# Slack addon for OpenTMI


## Configurations

```
{
  "opentmi-slack": {
    "token": "<token>",
    "defaultChannelName": "<bot-channel>",
    "filters": {
      "allowedChannels": ["<channelName>"],
      "allowedUsers": ["<real_name>"]
    },
    "result": {
      "template": "New test result for {{tcid}} : {{exec.verdict}} ({{exec.note}})",
      "filter": <filter-object>
    }
  }
}
```
